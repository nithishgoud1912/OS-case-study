# Case Study 14: Race Condition in xv6 Shared Data

This clean project demonstrates one shared kernel structure: xv6's physical-page free list. The C program first forces two threads to read the same list head without a lock, then protects the complete pop operation with one spinlock. It checks whether every page appears exactly once across the allocations and the remaining free list.

## Files

- `src/race_demo.c` - complete runnable C demonstration
- `Makefile` - build and run shortcuts
- `GUIDE_Run_and_Explain_Case_Study_14.md` - start-to-finish run instructions and code explanations
- `evidence/run_output.txt` - output captured from the completed run
- `output/` - report, presentation, and speaker script

## Build and run in WSL Ubuntu 24.04

From PowerShell:

```powershell
wsl -d Ubuntu-24.04
```

Then in the WSL shell:

```bash
cd "/mnt/c/Users/HP/Documents/OS record/OS CASE STUDY/case_study_14_rebuild"
make clean
make run
```

Or compile directly:

```bash
mkdir -p build
gcc -std=c11 -Wall -Wextra -Wpedantic -O2 -pthread src/race_demo.c -o build/race_demo
./build/race_demo
```

For the full walkthrough, see `GUIDE_Run_and_Explain_Case_Study_14.md`.

## What the program demonstrates

The uncontrolled mode uses a two-thread barrier only to reproduce one specific schedule: both workers read page `P0` before either updates the head. Atomic pointer loads and stores keep the host-side test well-defined, but they do not make the combined read-and-update operation indivisible. Both workers therefore return `P0`.

The corrected mode uses an xv6-style spinlock around the whole list pop. The lock holder reads the head and advances it before releasing the lock. The second worker then reads the next page. The final audit checks the page ownership invariant directly.

This is a user-space teaching model that mirrors `kernel/kalloc.c`; it does not boot or modify the xv6 kernel. The local xv6 source used for comparison is in `../xv6-riscv/` at commit `ae7cff64d1cd1153e98794d19c46235ead934cf2`.
