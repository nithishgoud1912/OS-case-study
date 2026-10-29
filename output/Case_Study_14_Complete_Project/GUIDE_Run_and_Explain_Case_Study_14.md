# Case Study 14: Run Guide and C Code Explanation

This guide shows how to build and run the demonstration from a clean start, then explains the important code in short sections.

## What the program demonstrates

The program models the physical-page free list used by xv6's `kalloc()` allocator. It starts with three pages (`P0`, `P1`, and `P2`) and two worker threads.

- In the **unlocked run**, both workers are deliberately made to read the same free-list head before either updates it. Both therefore receive `P0`.
- In the **spinlock run**, one worker completes the whole read-and-update operation before the other can enter it. They receive `P0` and `P1`.
- At the end of each run, an audit checks that every page appears exactly once across the workers' allocations and the pages still on the free list.

This is a controlled user-space teaching model of xv6's free-list operation. It does not boot or change the xv6 kernel. The worker threads stand in for two CPUs, and a barrier makes the unsafe interleaving repeatable.

## Project files

- `src/race_demo.c` - complete C program
- `Makefile` - build, run, and clean shortcuts
- `evidence/run_output.txt` - output captured from a successful build and run
- `output/` - report, presentation, and speaker script

## 1. Open the project in WSL

This project was built with WSL Ubuntu 24.04, GCC, and GNU Make.

1. Open PowerShell or Windows Terminal.
2. Start the Ubuntu environment:

   ```powershell
   wsl -d Ubuntu-24.04
   ```

3. In the Ubuntu shell, go to the project folder. Keep the quotation marks because the Windows path contains spaces:

   ```bash
   cd "/mnt/c/Users/HP/Documents/OS record/OS CASE STUDY/case_study_14_rebuild"
   ```

4. Check that you are in the right folder and that the tools are available:

   ```bash
   pwd
   ls
   gcc --version
   make --version
   ```

You should see `src`, `Makefile`, `README.md`, `evidence`, and `output`. If Ubuntu says that `gcc` or `make` is missing, install the compiler tools once:

```bash
sudo apt update
sudo apt install build-essential
```

If you extracted the ZIP to another location, use that folder's WSL path in the `cd` command instead.

## 2. Build and run

From the project folder in Ubuntu, run:

```bash
make clean
make run
```

`make clean` removes the previous compiled program. `make run` compiles `src/race_demo.c` into `build/race_demo` and runs it. The `Makefile` creates the `build` folder during compilation.

You can also build and run in separate steps:

```bash
make
./build/race_demo
```

Or compile directly without using the Makefile:

```bash
mkdir -p build
gcc -std=c11 -Wall -Wextra -Wpedantic -O2 -pthread src/race_demo.c -o build/race_demo
./build/race_demo
```

The `-pthread` option enables POSIX threads. The warning options help GCC report common C mistakes. `-O2` enables compiler optimization.

## 3. Expected result

The important lines should look like this:

```text
UNLOCKED RUN (controlled interleaving)
  CPU 0 read head P0; CPU 1 read head P0
  Allocations: CPU 0 = P0, CPU 1 = P0
  Same page returned twice: YES
  Free-list head after both pops: P1
  Pages present exactly once (allocated + free): 2 / 3
  State: INCONSISTENT

SPINLOCK RUN (lock covers the complete pop)
  Allocations: CPU 0 = P0, CPU 1 = P1
  Same page returned twice: NO
  Free-list head after both pops: P2
  Pages present exactly once (allocated + free): 3 / 3
  State: CONSISTENT

DEMONSTRATION CHECK: PASS (race reproduced; spinlock preserved the invariant)
```

`2 / 3` means two page IDs appear exactly once. In the unlocked run, `P0` appears twice in the allocations, while `P1` and `P2` remain in the free list. So this example demonstrates duplicate ownership of `P0`; it does not mean that `P2` disappeared. In the spinlock run, `P0`, `P1`, and `P2` each appear once across the allocations and remaining free list.

The final `PASS` means the program observed the expected inconsistent unlocked result and the consistent spinlock result. To check the program's exit status immediately afterward, run:

```bash
echo $?
```

`0` means the demonstration check passed. A nonzero value means a setup or demonstration check failed.

## 4. Code explanation in snippets

### A. The shared free-list data

```c
enum { NCPU = 2, NPAGES = 3 };

struct run {
    int id;
    struct run *next;
};

static struct run pages[NPAGES];
static struct run *freelist;
static struct spinlock kmem_lock;
```

Each `run` represents one physical page. Its `next` pointer links to the next free page. `freelist` is the shared head pointer: initially it points to `P0`, followed by `P1`, then `P2`. Both worker threads access this shared head. That makes the list update a critical section.

### B. The spinlock

```c
static void acquire(struct spinlock *lock)
{
    while (__atomic_exchange_n(&lock->locked, 1, __ATOMIC_ACQUIRE) != 0)
        sched_yield();
}

static void release(struct spinlock *lock)
{
    __atomic_store_n(&lock->locked, 0, __ATOMIC_RELEASE);
}
```

`acquire()` repeatedly tries to change `locked` from `0` to `1`. Only one thread can successfully claim it at a time; the other waits. `release()` sets it back to `0`, allowing another thread to enter. The acquire/release ordering makes the lock's ownership changes visible between threads. `sched_yield()` lets a waiting thread give up its CPU time briefly while it retries.

### C. The unlocked operation that reproduces the inconsistency

```c
struct run *page = __atomic_load_n(&freelist, __ATOMIC_RELAXED);
struct run *next = page ? page->next : NULL;
observed[cpu] = page;

pthread_barrier_wait(&both_cpus_loaded);

if (page != NULL)
    __atomic_store_n(&freelist, next, __ATOMIC_RELAXED);
allocated[cpu] = page;
```

Each worker first reads the head (`P0`) and saves its next pointer (`P1`). The barrier pauses both workers until both have completed those reads. Then each worker writes `P1` as the new head and returns the page it read, `P0`. The writes to the head do not protect the complete read-and-update sequence, so both workers can claim the same page.

The pointer reads and writes are atomic so this host-side C example avoids undefined behavior from simultaneous ordinary pointer access. The multi-step list operation is still not protected as one indivisible operation, which is the synchronization bug being demonstrated.

### D. The corrected operation

```c
acquire(&kmem_lock);
struct run *page = __atomic_load_n(&freelist, __ATOMIC_RELAXED);
if (page != NULL)
    __atomic_store_n(&freelist, page->next, __ATOMIC_RELAXED);
release(&kmem_lock);

allocated[cpu] = page;
```

The lock surrounds both reading the head and advancing it. The first worker removes `P0` and changes the head to `P1`. Only after it releases the lock can the second worker read the head; it gets `P1` and changes the head to `P2`. This is mutual exclusion: only one worker modifies the shared list at a time.

### E. Checking the data invariant

```c
/* Count each page found in the workers' allocations. */
++occurrences[id];

/* Walk the remaining free list and count those pages too. */
++occurrences[id];

/* Every page must occur exactly once. */
if (occurrences[i] == 1)
    ++*exactly_once;
else
    valid = false;
```

The real `audit_state()` function also checks for invalid page IDs, repeated entries, and cycles in the list. The intended invariant is: each page is either allocated to exactly one worker or is free in the list, never both and never duplicated. The audit is what turns the observed behavior into a clear consistency result.

### F. Running both cases

The program initializes the three-page list, runs two worker threads with the unsafe operation, prints and checks the result, then initializes the list again and repeats with the spinlock operation. Reinitializing is important: each case starts from the same clean state, so the outcomes can be compared fairly.

## 5. How to explain the demonstration

You can describe the run in this order:

1. “The free-list head is shared by both workers.”
2. “Without a lock, both read `P0` before either changes the head.”
3. “Both return `P0`, so a page has two owners. That violates the invariant.”
4. “With the spinlock, the full read-and-update sequence is protected.”
5. “The workers then receive `P0` and `P1`; the audit finds all three pages exactly once.”

The barrier is only a test harness to reproduce the harmful schedule reliably. It is not the fix. The spinlock is the synchronization method that prevents the inconsistent update.

## 6. Common issues

- **`wsl: command not found` or distribution not found:** run the WSL command from Windows PowerShell, and confirm the Ubuntu distribution is installed.
- **`gcc` or `make` not found:** install `build-essential` once inside Ubuntu using the commands above.
- **`No such file or directory` after `cd`:** check the spelling and quote the entire path because it contains spaces. If the project was extracted elsewhere, use its new location.
- **`make: *** No rule to make target` or no `Makefile`:** run `pwd` and `ls` to confirm you are in `case_study_14_rebuild`, not its parent folder.
- **Direct GCC command cannot create `build/race_demo`:** run `mkdir -p build` before compiling, or use `make run`.

## Scope note

This program demonstrates one controlled interleaving in a user-space model of xv6's physical-page allocator. It is not a benchmark and does not establish how every possible kernel schedule behaves. The result illustrates why the critical section must be protected by a lock.
