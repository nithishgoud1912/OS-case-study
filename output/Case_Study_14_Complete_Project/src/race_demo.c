#define _XOPEN_SOURCE 700
#include <pthread.h>
#include <sched.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* A small user-space model of xv6's kernel/kalloc.c free list. */
enum { NCPU = 2, NPAGES = 3 };

struct run {
    int id;
    struct run *next;
};

struct spinlock {
    int locked;
};

static struct run pages[NPAGES];
static struct run *freelist;
static struct spinlock kmem_lock;
static pthread_barrier_t both_cpus_loaded;
static struct run *observed[NCPU];
static struct run *allocated[NCPU];

struct worker_arg {
    int cpu;
};

/* Same spinlock idea used by xv6: atomic ownership with acquire/release order. */
static void acquire(struct spinlock *lock)
{
    while (__atomic_exchange_n(&lock->locked, 1, __ATOMIC_ACQUIRE) != 0)
        sched_yield();
}

static void release(struct spinlock *lock)
{
    __atomic_store_n(&lock->locked, 0, __ATOMIC_RELEASE);
}

static void init_free_list(void)
{
    for (int i = 0; i < NPAGES; ++i) {
        pages[i].id = i;
        pages[i].next = (i + 1 < NPAGES) ? &pages[i + 1] : NULL;
    }

    __atomic_store_n(&freelist, &pages[0], __ATOMIC_RELAXED);
    __atomic_store_n(&kmem_lock.locked, 0, __ATOMIC_RELAXED);
    memset(observed, 0, sizeof(observed));
    memset(allocated, 0, sizeof(allocated));
}

/*
 * Deliberately unsafe pop. The test barrier forces both CPUs to read the same
 * head before either publishes its new head. Atomic pointer operations keep
 * this host-side demonstration defined, but they do not protect the complete
 * read-modify-write operation.
 */
static void *unsafe_worker(void *arg)
{
    const int cpu = ((struct worker_arg *)arg)->cpu;
    struct run *page = __atomic_load_n(&freelist, __ATOMIC_RELAXED);
    struct run *next = page ? page->next : NULL;
    observed[cpu] = page;

    const int barrier_status = pthread_barrier_wait(&both_cpus_loaded);
    if (barrier_status != 0 && barrier_status != PTHREAD_BARRIER_SERIAL_THREAD) {
        fprintf(stderr, "pthread_barrier_wait failed: %s\n", strerror(barrier_status));
        abort();
    }

    if (page != NULL)
        __atomic_store_n(&freelist, next, __ATOMIC_RELAXED);
    allocated[cpu] = page;
    return NULL;
}

/* The spinlock covers both the head read and the head update as one operation. */
static void *spinlock_worker(void *arg)
{
    const int cpu = ((struct worker_arg *)arg)->cpu;

    acquire(&kmem_lock);
    struct run *page = __atomic_load_n(&freelist, __ATOMIC_RELAXED);
    if (page != NULL)
        __atomic_store_n(&freelist, page->next, __ATOMIC_RELAXED);
    release(&kmem_lock);

    allocated[cpu] = page;
    return NULL;
}

static int run_pair(void *(*worker)(void *), struct worker_arg args[NCPU])
{
    pthread_t threads[NCPU];

    for (int i = 0; i < NCPU; ++i) {
        const int rc = pthread_create(&threads[i], NULL, worker, &args[i]);
        if (rc != 0) {
            fprintf(stderr, "pthread_create failed: %s\n", strerror(rc));
            return -1;
        }
    }

    for (int i = 0; i < NCPU; ++i) {
        const int rc = pthread_join(threads[i], NULL);
        if (rc != 0) {
            fprintf(stderr, "pthread_join failed: %s\n", strerror(rc));
            return -1;
        }
    }
    return 0;
}

static int page_id(const struct run *page)
{
    return page ? page->id : -1;
}

/* Verify every page appears exactly once across allocations and the free list. */
static bool audit_state(int *exactly_once)
{
    int occurrences[NPAGES] = {0};
    bool seen_in_list[NPAGES] = {false};
    bool valid = true;
    int steps = 0;

    for (int cpu = 0; cpu < NCPU; ++cpu) {
        if (allocated[cpu] != NULL) {
            const int id = page_id(allocated[cpu]);
            if (id < 0 || id >= NPAGES) {
                valid = false;
            } else {
                ++occurrences[id];
            }
        }
    }

    struct run *page = __atomic_load_n(&freelist, __ATOMIC_RELAXED);
    while (page != NULL && steps < NPAGES) {
        const int id = page_id(page);
        if (id < 0 || id >= NPAGES || seen_in_list[id]) {
            valid = false;
            break;
        }
        seen_in_list[id] = true;
        ++occurrences[id];
        ++steps;
        page = page->next;
    }
    if (page != NULL)
        valid = false;

    *exactly_once = 0;
    for (int i = 0; i < NPAGES; ++i) {
        if (occurrences[i] == 1)
            ++*exactly_once;
        else
            valid = false;
    }
    return valid;
}

static void print_state(const char *label, bool show_observed)
{
    int exactly_once = 0;
    const bool consistent = audit_state(&exactly_once);
    const struct run *head = __atomic_load_n(&freelist, __ATOMIC_RELAXED);

    printf("%s\n", label);
    if (show_observed) {
        printf("  CPU 0 read head P%d; CPU 1 read head P%d\n",
               page_id(observed[0]), page_id(observed[1]));
    }
    printf("  Allocations: CPU 0 = P%d, CPU 1 = P%d\n",
           page_id(allocated[0]), page_id(allocated[1]));
    printf("  Same page returned twice: %s\n",
           allocated[0] != NULL && allocated[0] == allocated[1] ? "YES" : "NO");
    printf("  Free-list head after both pops: P%d\n", page_id(head));
    printf("  Pages present exactly once (allocated + free): %d / %d\n",
           exactly_once, NPAGES);
    printf("  State: %s\n\n", consistent ? "CONSISTENT" : "INCONSISTENT");
}

int main(void)
{
    struct worker_arg args[NCPU] = {{.cpu = 0}, {.cpu = 1}};
    const int barrier_rc = pthread_barrier_init(&both_cpus_loaded, NULL, NCPU);
    if (barrier_rc != 0) {
        fprintf(stderr, "pthread_barrier_init failed: %s\n", strerror(barrier_rc));
        return 1;
    }

    printf("XV6-style physical-page free-list demonstration\n");
    printf("Two CPU threads, three pages, one allocation per thread\n\n");

    init_free_list();
    if (run_pair(unsafe_worker, args) != 0)
        return 1;
    print_state("UNLOCKED RUN (controlled interleaving)", true);
    const bool unsafe_reproduced = allocated[0] != NULL &&
                                   allocated[0] == allocated[1] &&
                                   page_id(__atomic_load_n(&freelist, __ATOMIC_RELAXED)) == 1;

    const int destroy_rc = pthread_barrier_destroy(&both_cpus_loaded);
    if (destroy_rc != 0) {
        fprintf(stderr, "pthread_barrier_destroy failed: %s\n", strerror(destroy_rc));
        return 1;
    }

    init_free_list();
    if (run_pair(spinlock_worker, args) != 0)
        return 1;
    print_state("SPINLOCK RUN (lock covers the complete pop)", false);
    int exact_count = 0;
    const bool spinlock_consistent = audit_state(&exact_count) && exact_count == NPAGES;
    const bool demonstration_passed = unsafe_reproduced && spinlock_consistent;

    printf("DEMONSTRATION CHECK: %s\n",
           demonstration_passed
               ? "PASS (race reproduced; spinlock preserved the invariant)"
               : "FAIL (expected outcomes were not observed)");
    return demonstration_passed ? 0 : 1;
}
