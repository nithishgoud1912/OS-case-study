# Case Study 14: Run and Explain the xv6 Implementation

This guide builds and runs the race-condition experiment inside xv6. The kernel code—not a host-side pthread program—performs the shared free-list operations and uses xv6's spinlock implementation.

## What the experiment does

The experiment models the `head` and `next` pointer operation in xv6's physical-page allocator. It creates a small, test-only kernel free list with three entries: `P0`, `P1`, and `P2`. Two xv6 user processes enter kernel system calls from separate QEMU harts:

- **Unlocked case:** both harts read `P0` before either updates the list head. Both return `P0`, demonstrating duplicate ownership.
- **Spinlock case:** xv6's spinlock protects the full read-and-update operation. The workers receive `P0` and `P1`; `P2` remains free.
- **Audit:** the kernel checks whether every page ID appears exactly once across the allocations and the remaining free list.

The unsafe test uses a separate list rather than damaging xv6's production allocator. `kernel/kalloc.c` remains protected by its normal `kmem.lock`. The demo itself runs inside xv6 on two QEMU harts and calls xv6's real `acquire()` and `release()` functions for the corrected run.

## Files to know

- `xv6-riscv/kernel/racecheck.c` - test data, kernel worker operations, spinlock, and invariant audit
- `xv6-riscv/user/racetest.c` - user program that creates two child processes, waits for them, and requests the kernel report
- `xv6-riscv/kernel/kalloc.c` - production allocator showing the real `kmem.freelist` and `kmem.lock`
- `xv6-riscv/kernel/syscall.h` and `kernel/syscall.c` - syscall numbers and dispatch table
- `xv6-riscv/user/usys.pl` and `user/user.h` - user-side syscall stubs and declarations
- `evidence/xv6_qemu_run.txt` - captured output from a successful xv6 run

## 1. Start WSL Ubuntu

Open PowerShell or Windows Terminal and run:

```powershell
wsl -d Ubuntu-24.04
```

The commands below are run inside the Ubuntu shell. The project path contains spaces, so keep the quotation marks:

```bash
cd "/mnt/c/Users/HP/Documents/OS record/OS CASE STUDY/case_study_14_rebuild/xv6-riscv"
```

Check the RISC-V compiler and QEMU are available:

```bash
riscv64-linux-gnu-gcc --version
qemu-system-riscv64 --version
make --version
```

If the compiler or QEMU tools are missing in Ubuntu, install the usual xv6 build packages:

```bash
sudo apt update
sudo apt install build-essential gcc-riscv64-linux-gnu binutils-riscv64-linux-gnu qemu-system-misc
```

## 2. Clean, build, and boot xv6

Run this from the `xv6-riscv` directory:

```bash
make clean
make -j4 DETFLAGS= qemu CPUS=2
```

The build compiles the RISC-V kernel, adds the `racetest` user program to `fs.img`, then starts QEMU with two harts. `DETFLAGS=` avoids a path-with-spaces issue in this workspace. Wait for the xv6 shell prompt:

```text
$
```

## 3. Run the test inside xv6

At the xv6 shell prompt, type:

```text
racetest
```

The program runs both cases automatically. When it prints the final PASS line, exit QEMU's nographic console by pressing **Ctrl+A**, releasing those keys, and then pressing **X**.

To rerun, boot xv6 again with `make -j4 DETFLAGS= qemu CPUS=2` and type `racetest` at the shell prompt.

## 4. Expected output and meaning

The captured run should include these results:

```text
[xv6 race demo] UNLOCKED free-list pop
  user workers ran on harts 0 and 1
  head values read: P0 and P0
  allocated pages: P0 and P0
  same page returned twice: YES
  free-list head after both pops: P1
  page IDs appearing exactly once: 2 / 3
  invariant: INCONSISTENT
  xv6 check: PASS

[xv6 race demo] SPINLOCK free-list pop
  user workers ran on harts 0 and 1
  allocated pages: P0 and P1
  same page returned twice: NO
  free-list head after both pops: P2
  page IDs appearing exactly once: 3 / 3
  invariant: CONSISTENT
  xv6 check: PASS
XV6 RACE DEMO: PASS (inconsistency reproduced; spinlock fixed it)
```

`2 / 3` means two page IDs occur exactly once. In the unlocked case, `P0` occurs twice in the allocations, while `P1` and `P2` remain linked in the free list. The problem is duplicate ownership of `P0`; the output does not claim that `P2` disappeared. In the spinlock run, `P0`, `P1`, and `P2` each occur exactly once across allocated pages and the free list.

The PASS label is the test program's expected-outcome check: it passes when the unlocked case reproduces the duplicate and the spinlock case satisfies the invariant on distinct harts.

## 5. Code walkthrough in snippets

### A. Production xv6 allocator pattern

In `kernel/kalloc.c`, xv6 protects the real allocator's list head this way:

```c
acquire(&kmem.lock);
r = kmem.freelist;
if (r)
  kmem.freelist = r->next;
release(&kmem.lock);
```

`kmem.freelist` is shared by kernel code that allocates and frees physical pages. The read of the head and the update to the head form one critical section. The same lock must cover both steps.

### B. Test free-list structure

The xv6 test module defines a small page-like node and a shared head:

```c
struct race_run {
  int id;
  struct race_run *next;
};

static struct {
  struct spinlock lock;
  struct race_run pages[3];
  struct race_run *freelist;
  /* per-worker observations and allocations */
} demo;
```

This is kernel data inside xv6, arranged like a linked free list. It is kept separate from the live `kmem.freelist` so the intentionally unsafe case cannot break shell memory allocation.

### C. Two real xv6 harts enter the kernel

The user program forks two processes, and each calls `raceworker(worker_id)`. The kernel test assigns worker 0 to hart 0 and worker 1 to hart 1:

```c
for (;;) {
  while (cpuid() != worker_id)
    yield();

  push_off();
  if (cpuid() == worker_id)
    return;
  pop_off();
}
```

`yield()` lets a process wait until it is scheduled on its assigned hart. The second check after `push_off()` closes the small gap where a timer interrupt could otherwise move it between harts. The run output reports the actual hart IDs so the demonstration can verify both were used.

### D. Reproduce the race without the lock

The unlocked path reads the old head and its next pointer, then rendezvouses with the other worker before writing the head:

```c
page = __atomic_load_n(&demo.freelist, __ATOMIC_RELAXED);
struct race_run *next = page ? page->next : 0;
demo.observed[worker_id] = page;

rendezvous(worker_id);

if (page)
  __atomic_store_n(&demo.freelist, next, __ATOMIC_RELAXED);
```

Both harts read `P0` and save `P1` as the next pointer. The rendezvous waits until both have completed those reads. Then both store `P1` as the new head and both return `P0`. The head update is atomic as an individual pointer store, but the whole read-and-update operation is not protected as one critical section.

The test's atomic loads and stores keep the host-language accesses defined. The demonstrated error is the unsynchronized multi-step update, which gives the same page to two allocators.

### E. Protect the whole operation with the xv6 spinlock

The corrected path uses xv6's `acquire()` and `release()`:

```c
rendezvous(worker_id);
acquire(&demo.lock);
page = __atomic_load_n(&demo.freelist, __ATOMIC_RELAXED);
if (page)
  __atomic_store_n(&demo.freelist, page->next, __ATOMIC_RELAXED);
release(&demo.lock);
```

Both harts are ready before the lock contest begins. One acquires the lock, returns `P0`, and advances the head to `P1`. The other waits; after the first releases the lock, it reads `P1` and advances the head to `P2`. Mutual exclusion makes the full list operation appear indivisible to competing workers.

The lock is xv6's kernel spinlock, implemented in `kernel/spinlock.c`. Its atomic exchange claims the lock, and its atomic store releases it. No pthread or host lock is involved.

### F. Check the ownership invariant

The kernel audit counts page IDs among the two allocations and the pages left on the list. For every page, the expected count is exactly one:

```c
if (occurrences[i] == 1)
  (*exactly_once)++;
else
  valid = 0;
```

The audit also detects invalid IDs, repeated free-list nodes, and cycles. The unlocked run fails the invariant because `P0` appears twice. The spinlock run passes because every page appears exactly once.

### G. Test flow

`user/racetest.c` resets the kernel test state, forks two child processes, and has each child call the worker system call. The parent waits for both children before asking the kernel to print the audit. It repeats this from a fresh initial list for the spinlock case.

System-call wiring connects the user program to kernel code: syscall numbers are in `kernel/syscall.h`, dispatch is in `kernel/syscall.c`, and user stubs are generated from `user/usys.pl` with declarations in `user/user.h`.

## 6. How to present the result

1. Point to `kernel/kalloc.c`: xv6 already protects `kmem.freelist` with `kmem.lock`.
2. Explain the harmful interleaving: two harts read `P0` before either publishes the new head.
3. Show the unlocked output: both children receive `P0`; the invariant says INCONSISTENT.
4. Show the spinlock output: the children receive `P0` and `P1`; the invariant says CONSISTENT.
5. Explain that the kernel test uses a separate list to keep the deliberate failure from corrupting the real allocator.

## Troubleshooting

- **No RISC-V compiler:** install `gcc-riscv64-linux-gnu` and `binutils-riscv64-linux-gnu` inside Ubuntu.
- **QEMU command missing:** install `qemu-system-misc` inside Ubuntu.
- **The worker harts are not 0 and 1:** make sure the image was booted with `CPUS=2`; the test pins its workers to harts 0 and 1 and reports failure if they do not run on separate harts.
- **The `racetest` command is missing:** run `make clean` and rebuild with `make -j4 DETFLAGS= qemu CPUS=2`; this refreshes `fs.img` with the new user program.
- **Path not found:** confirm the `cd` command includes `/xv6-riscv` and keeps the quotation marks around the path.
