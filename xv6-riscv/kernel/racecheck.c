/*
 * Race-condition case study for xv6.
 *
 * This test-only free list mirrors the head/next pop used by kmem.freelist in
 * kalloc.c. Two xv6 user processes enter the kernel on separate QEMU harts.
 * The unlocked case forces both to read the same head; the locked case uses
 * xv6's acquire()/release() spinlock around the complete pop operation.
 */
#include "types.h"
#include "param.h"
#include "spinlock.h"
#include "riscv.h"
#include "proc.h"
#include "defs.h"

enum { RACE_WORKERS = 2, RACE_PAGES = 3 };
enum { RACE_UNLOCKED = 0, RACE_SPINLOCK = 1 };

struct race_run {
  int id;
  struct race_run *next;
};

static struct {
  struct spinlock lock;
  struct race_run pages[RACE_PAGES];
  struct race_run *freelist;
  int mode;
  int ready;
  int hart[RACE_WORKERS];
  struct race_run *observed[RACE_WORKERS];
  struct race_run *allocated[RACE_WORKERS];
} demo;

static int
page_id(struct race_run *page)
{
  return page ? page->id : -1;
}

static void
reset_demo(int mode)
{
  initlock(&demo.lock, "race-demo");
  demo.mode = mode;
  __atomic_store_n(&demo.ready, 0, __ATOMIC_RELAXED);

  for (int i = 0; i < RACE_PAGES; i++) {
    demo.pages[i].id = i;
    demo.pages[i].next = i + 1 < RACE_PAGES ? &demo.pages[i + 1] : 0;
  }
  __atomic_store_n(&demo.freelist, &demo.pages[0], __ATOMIC_RELAXED);

  for (int i = 0; i < RACE_WORKERS; i++) {
    demo.hart[i] = -1;
    demo.observed[i] = 0;
    demo.allocated[i] = 0;
  }
}

/*
 * Keep both user processes in the kernel until both have arrived. In the
 * unlocked case, each process calls this only after reading the head. In the
 * spinlock case, each calls it immediately before acquiring the lock.
 */
static void
rendezvous(int worker_id)
{
  demo.hart[worker_id] = cpuid();
  __atomic_fetch_add(&demo.ready, 1, __ATOMIC_ACQ_REL);
  while (__atomic_load_n(&demo.ready, __ATOMIC_ACQUIRE) < RACE_WORKERS)
    __asm__ volatile("nop");
}

/* Keep worker 0 on hart 0 and worker 1 on hart 1 for this experiment. */
static void
pin_worker_to_hart(int worker_id)
{
  for (;;) {
    while (cpuid() != worker_id)
      yield();

    /* Prevent a timer interrupt from migrating the process between check
     * and entry to the test's critical section. */
    push_off();
    if (cpuid() == worker_id)
      return;
    pop_off();
  }
}

uint64
sys_raceinit(void)
{
  int mode;
  argint(0, &mode);
  if (mode != RACE_UNLOCKED && mode != RACE_SPINLOCK)
    return -1;

  reset_demo(mode);
  return 0;
}

uint64
sys_raceworker(void)
{
  int worker_id;
  argint(0, &worker_id);
  if (worker_id < 0 || worker_id >= RACE_WORKERS)
    return -1;

  pin_worker_to_hart(worker_id);
  struct race_run *page;

  if (demo.mode == RACE_UNLOCKED) {
    page = __atomic_load_n(&demo.freelist, __ATOMIC_RELAXED);
    struct race_run *next = page ? page->next : 0;
    demo.observed[worker_id] = page;

    /* Both workers now hold the same old head and its next pointer. */
    rendezvous(worker_id);

    if (page)
      __atomic_store_n(&demo.freelist, next, __ATOMIC_RELAXED);
  } else {
    rendezvous(worker_id);
    acquire(&demo.lock);
    page = __atomic_load_n(&demo.freelist, __ATOMIC_RELAXED);
    if (page)
      __atomic_store_n(&demo.freelist, page->next, __ATOMIC_RELAXED);
    demo.observed[worker_id] = page;
    release(&demo.lock);
  }

  demo.allocated[worker_id] = page;
  pop_off();
  return page ? 0 : -1;
}

/* Check the page-ownership invariant across allocations and the free list. */
static int
audit_state(int *exactly_once)
{
  int occurrences[RACE_PAGES] = {0};
  int seen[RACE_PAGES] = {0};
  int valid = 1;

  for (int i = 0; i < RACE_WORKERS; i++) {
    struct race_run *page = demo.allocated[i];
    if (page) {
      int id = page_id(page);
      if (id < 0 || id >= RACE_PAGES)
        valid = 0;
      else
        occurrences[id]++;
    }
  }

  struct race_run *page = __atomic_load_n(&demo.freelist, __ATOMIC_RELAXED);
  int steps = 0;
  while (page && steps < RACE_PAGES) {
    int id = page_id(page);
    if (id < 0 || id >= RACE_PAGES || seen[id]) {
      valid = 0;
      break;
    }
    seen[id] = 1;
    occurrences[id]++;
    steps++;
    page = page->next;
  }
  if (page)
    valid = 0;

  *exactly_once = 0;
  for (int i = 0; i < RACE_PAGES; i++) {
    if (occurrences[i] == 1)
      (*exactly_once)++;
    else
      valid = 0;
  }
  return valid;
}

uint64
sys_racereport(void)
{
  int exactly_once;
  int consistent = audit_state(&exactly_once);
  struct race_run *head = __atomic_load_n(&demo.freelist, __ATOMIC_RELAXED);
  int duplicate = demo.allocated[0] != 0 &&
                  demo.allocated[0] == demo.allocated[1];
  int two_harts = demo.hart[0] >= 0 && demo.hart[1] >= 0 &&
                  demo.hart[0] != demo.hart[1];
  int expected;

  printk("\n[xv6 race demo] %s\n",
         demo.mode == RACE_UNLOCKED ? "UNLOCKED free-list pop" :
                                      "SPINLOCK free-list pop");
  printk("  user workers ran on harts %d and %d\n",
         demo.hart[0], demo.hart[1]);
  if (demo.mode == RACE_UNLOCKED)
    printk("  head values read: P%d and P%d\n",
           page_id(demo.observed[0]), page_id(demo.observed[1]));
  printk("  allocated pages: P%d and P%d\n",
         page_id(demo.allocated[0]), page_id(demo.allocated[1]));
  printk("  same page returned twice: %s\n", duplicate ? "YES" : "NO");
  printk("  free-list head after both pops: P%d\n", page_id(head));
  printk("  page IDs appearing exactly once: %d / %d\n",
         exactly_once, RACE_PAGES);
  printk("  invariant: %s\n", consistent ? "CONSISTENT" : "INCONSISTENT");

  if (demo.mode == RACE_UNLOCKED)
    expected = two_harts && duplicate && !consistent &&
               exactly_once == RACE_PAGES - 1 && page_id(head) == 1 &&
               page_id(demo.observed[0]) == 0 &&
               page_id(demo.observed[1]) == 0;
  else
    expected = two_harts && !duplicate && consistent &&
               exactly_once == RACE_PAGES && page_id(head) == 2 &&
               page_id(demo.allocated[0]) != page_id(demo.allocated[1]);

  printk("  xv6 check: %s\n", expected ? "PASS" : "FAIL");
  return expected ? 0 : -1;
}
