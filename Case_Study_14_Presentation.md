# Case Study 14: Race Condition in XV6 Shared Data

---

## 1. Introduction

**Objective:** Study how race conditions occur when multiple CPUs access shared kernel data without synchronization, and demonstrate how XV6 prevents inconsistent updates using **two different methods**: spinlocks and per-CPU free lists.

**Platform Used:**
| Component | Details |
|-----------|---------|
| Operating System | XV6 (RISC-V) |
| Emulator | QEMU with 2 harts (CPUs) |
| Toolchain | `riscv64-linux-gnu-gcc` on WSL Ubuntu |
| Synchronization Method 1 | XV6 Kernel Spinlock (`acquire()` / `release()`) |
| Synchronization Method 2 | Per-CPU Free Lists (partitioned allocator with per-CPU locks) |

---

## 2. Key Concepts

### 2.1 Race Condition
A race condition occurs when **two or more CPUs/threads** access **shared data simultaneously**, and the final result depends on the **order of execution**. If the operations are not atomic, data becomes inconsistent.

### 2.2 Critical Section
A critical section is a block of code that accesses shared data. Only **one CPU** should execute a critical section at a time.

### 2.3 Mutual Exclusion
A property ensuring that when one CPU is inside the critical section, **no other CPU** can enter it. XV6 achieves this using **spinlocks**.

### 2.4 Per-CPU Data Partitioning
An optimization where shared data is split into per-CPU copies. Each CPU operates on its own copy with its own lock, eliminating contention in the common case. XV6's production allocator uses this technique.

---

## 3. Shared Data Structure Identified

The shared data structure we study is the **physical memory free list** in XV6's kernel allocator ([`kernel/kalloc.c`](file:///c:/Users/HP/Documents/OS%20record/OS%20CASE%20STUDY/case_study_14_rebuild/xv6-riscv/kernel/kalloc.c)).

```c
// kernel/kalloc.c — XV6 Production Allocator

struct run {
    struct run *next;          // pointer to next free page
};

struct {
    struct spinlock lock;      // lock protecting this CPU's free list
    struct run *freelist;      // head of this CPU's linked list of free pages
} kmem[NCPU];                 // one list per CPU
```

**What it does:** Every free physical page in XV6 is linked into one of the per-CPU lists. When the kernel needs a page, it **pops** from the current CPU's list. When a page is freed, it **pushes** it back onto the current CPU's list. If the local list is empty, it **steals** a page from another CPU's list.

**The critical section** in `kalloc()`:

```c
push_off();
int cpu = cpuid();
acquire(&kmem[cpu].lock);         // Step 1: Acquire the lock
r = kmem[cpu].freelist;           // Step 2: Read the head pointer
if (r)
    kmem[cpu].freelist = r->next; // Step 3: Advance the head
release(&kmem[cpu].lock);         // Step 4: Release the lock
```

> [!IMPORTANT]
> Steps 2 and 3 form the **critical section**. If two CPUs both execute Step 2 before either executes Step 3, they receive the **same page** — causing data corruption.

### 3.1 Why Steps 2 and 3 Must Be Atomic — Detailed Explanation

The `kalloc()` function performs a **two-step operation** on the shared free list:

- **Step 2 (`r = kmem[cpu].freelist`):** Reads the current head pointer — "which page is at the top of the free list?"
- **Step 3 (`kmem[cpu].freelist = r->next`):** Advances the head to the next page — "remove the top page from the list."

These two steps **depend on each other**. Step 3 assumes that the value read in Step 2 is still the current head. If another CPU modifies the head **between** Step 2 and Step 3, the assumption breaks.

#### Without Lock — Dangerous Interleaving

Suppose the free list is `P0 → P1 → P2 → NULL` and two CPUs call `kalloc()` at the same time on a shared list:

```
CPU 0 runs Step 2:   r = freelist             →  r = P0
                     (CPU 0 has NOT done Step 3 yet)

CPU 1 runs Step 2:   r = freelist             →  r = P0  (SAME page!)
                     (head is still P0 because nobody updated it yet)

CPU 0 runs Step 3:   freelist = r->next       →  head becomes P1
CPU 1 runs Step 3:   freelist = r->next       →  head becomes P1 (again, same write)
```

**Result of this interleaving:**
| What happened | Value |
|---------------|-------|
| CPU 0 received | `P0` |
| CPU 1 received | `P0` — **the same physical page** |
| Free list head | `P1` (only advanced by one, not two) |
| `P0` status | **Owned by two processes simultaneously** |
| `P1` status | Still on the free list, was never allocated |

Both CPUs now hold pointers to the **same physical memory**. When both processes write to that page, they overwrite each other's data — this is **memory corruption** at the kernel level.

#### With Lock — Safe Execution

The lock forces the two-step operation to complete **fully on one CPU** before the other CPU can begin:

```
CPU 0: acquire(&kmem.lock)           →  lock obtained ✅
CPU 0: r = kmem.freelist             →  r = P0
CPU 0: kmem.freelist = r->next       →  head becomes P1
CPU 0: release(&kmem.lock)           →  lock released

CPU 1: acquire(&kmem.lock)           →  lock obtained ✅ (was blocked until now)
CPU 1: r = kmem.freelist             →  r = P1 (head is already P1)
CPU 1: kmem.freelist = r->next       →  head becomes P2
CPU 1: release(&kmem.lock)           →  lock released
```

**Result of this serialized execution:**
| What happened | Value |
|---------------|-------|
| CPU 0 received | `P0` |
| CPU 1 received | `P1` — **a different page** |
| Free list head | `P2` (correctly advanced by two) |
| Every page | **Owned by exactly one entity** |

The lock guarantees that when CPU 1 executes Step 2, it sees the **updated** head (`P1`), not the stale value (`P0`). The read and update are treated as a single **indivisible operation** — this is what mutual exclusion provides.

---

## 4. Experiment Design

To safely demonstrate the race without corrupting XV6's real allocator, we created a **test-only kernel module** that mirrors the same linked-list pattern.

### 4.1 Test Free List Structure

```c
// kernel/racecheck.c — Test Module

struct race_run {
    int id;                     // page identifier (0, 1, or 2)
    struct race_run *next;      // link to next page
};

static struct {
    struct spinlock lock;       // XV6 spinlock for Method 1 (global spinlock)
    struct spinlock local_lock[RACE_WORKERS]; // per-CPU locks for Method 2
    struct race_run pages[3];   // three test pages: P0, P1, P2
    struct race_run *freelist;  // shared head pointer (used by Unlocked + Method 1)
    struct race_run *local_freelist[RACE_WORKERS]; // per-CPU lists (Method 2)
    int hart[2];                // which CPU each worker ran on
    struct race_run *allocated[2]; // what each worker received
} demo;
```

### 4.2 Initial State

**For Unlocked and Spinlock cases:**
```
freelist → [ P0 ] → [ P1 ] → [ P2 ] → NULL
```

**For Per-CPU case:**
```
CPU 0 list → [ P0 ] → [ P2 ] → NULL
CPU 1 list → [ P1 ] → NULL
```

Three pages linked together. Two worker processes (one per CPU) will each try to **pop** one page.

### 4.3 Files Involved

| File | Purpose |
|------|---------|
| [`kernel/racecheck.c`](file:///c:/Users/HP/Documents/OS%20record/OS%20CASE%20STUDY/case_study_14_rebuild/xv6-riscv/kernel/racecheck.c) | Kernel test engine — implements unlocked, spinlock, and per-CPU paths |
| [`user/racetest.c`](file:///c:/Users/HP/Documents/OS%20record/OS%20CASE%20STUDY/case_study_14_rebuild/xv6-riscv/user/racetest.c) | User program — forks 2 processes, runs all three test cases |
| [`kernel/syscall.c`](file:///c:/Users/HP/Documents/OS%20record/OS%20CASE%20STUDY/case_study_14_rebuild/xv6-riscv/kernel/syscall.c) | Syscall dispatch — wires user calls to kernel functions |
| [`kernel/kalloc.c`](file:///c:/Users/HP/Documents/OS%20record/OS%20CASE%20STUDY/case_study_14_rebuild/xv6-riscv/kernel/kalloc.c) | Production allocator — the real code we're studying |

---

## 5. Demonstrating the Race Condition (WITHOUT Lock)

### 5.1 Code — Unlocked Path

```c
// kernel/racecheck.c — UNLOCKED free-list pop (lines 132-141)

// Both CPU 0 and CPU 1 execute this simultaneously:

page = __atomic_load_n(&demo.freelist, __ATOMIC_RELAXED);   // Read head
next = page ? page->next : 0;                                // Save next pointer
demo.observed[worker_id] = page;                             // Record what was read

rendezvous(worker_id);   // ← WAIT until both CPUs have finished reading

if (page)
    __atomic_store_n(&demo.freelist, next, __ATOMIC_RELAXED); // Update head
```

### 5.2 Step-by-Step Timeline

```
Initial State:  freelist → P0 → P1 → P2 → NULL

Time    CPU 0 (Worker 0)              CPU 1 (Worker 1)
────    ────────────────              ────────────────
T1      READ head → gets P0          READ head → gets P0
T2      SAVE next → P1               SAVE next → P1
T3      ─── rendezvous (both have read) ───
T4      WRITE head = P1              WRITE head = P1
T5      RETURN P0 ✓                  RETURN P0 ✗ (DUPLICATE!)

Final State:  freelist → P1 → P2 → NULL
```

### 5.3 What Went Wrong

| Observation | Value |
|-------------|-------|
| CPU 0 allocated | **P0** |
| CPU 1 allocated | **P0** (same page!) |
| Free list head after pops | P1 |
| Pages appearing exactly once | 2 / 3 (P1 and P2 only) |
| P0 ownership | **Duplicated** — owned by both workers |
| Invariant | **INCONSISTENT** ❌ |

> [!CAUTION]
> **P0 is given to two different processes.** If this happened in the real allocator, two processes would write to the same physical page, corrupting each other's data — a critical kernel bug.

---

## 6. Method 1: Fixing with XV6 Spinlock (Global Lock)

### 6.1 Code — Spinlock Path

```c
// kernel/racecheck.c — SPINLOCK free-list pop (lines 142-149)

rendezvous(worker_id);              // Both CPUs are ready to compete

acquire(&demo.lock);                // ← ACQUIRE: only one CPU can proceed
page = __atomic_load_n(&demo.freelist, __ATOMIC_RELAXED);   // Read head
if (page)
    __atomic_store_n(&demo.freelist, page->next, __ATOMIC_RELAXED); // Update head
demo.observed[worker_id] = page;
release(&demo.lock);                // ← RELEASE: other CPU can now enter
```

### 6.2 Step-by-Step Timeline

```
Initial State:  freelist → P0 → P1 → P2 → NULL

Time    CPU 0 (Worker 0)              CPU 1 (Worker 1)
────    ────────────────              ────────────────
T1      ─── rendezvous (both ready) ───
T2      acquire(lock) ✅ GOT IT       acquire(lock) 🔒 SPINNING...
T3      READ head → gets P0               │ (waiting)
T4      WRITE head = P1                   │ (waiting)
T5      release(lock)                     │
T6                                    acquire(lock) ✅ GOT IT
T7                                    READ head → gets P1
T8                                    WRITE head = P2
T9                                    release(lock)
T10     RETURN P0 ✓                   RETURN P1 ✓

Final State:  freelist → P2 → NULL
```

### 6.3 Result After Fix

| Observation | Value |
|-------------|-------|
| CPU 0 allocated | **P0** |
| CPU 1 allocated | **P1** (different page) |
| Free list head after pops | P2 |
| Pages appearing exactly once | 3 / 3 (all pages) |
| Duplicate allocation | **NO** |
| Invariant | **CONSISTENT** ✅ |

> [!TIP]
> The spinlock ensures the **entire read-and-update** operation is treated as one **atomic critical section**. The second CPU must wait until the first CPU finishes before it can read the head.

---

## 7. Method 2: Fixing with Per-CPU Free Lists (Partitioned Allocator)

### 7.1 Concept

Instead of protecting one shared list with a single lock, we **partition** the free list into separate lists — one per CPU. Each CPU has its own lock protecting its own list. This is exactly what XV6's production `kalloc.c` does with `kmem[NCPU]`.

**Advantages over Method 1:**
- No contention between CPUs for local allocations
- Each CPU can allocate independently without blocking others
- Only cross-CPU stealing requires accessing another CPU's lock

### 7.2 Code — Per-CPU Path

```c
// kernel/racecheck.c — PER-CPU free-list pop (lines 150-159)

rendezvous(worker_id);
int cpu = cpuid();
acquire(&demo.local_lock[cpu]);     // ← Each CPU acquires its OWN lock
page = __atomic_load_n(&demo.local_freelist[cpu], __ATOMIC_RELAXED);
if (page)
    __atomic_store_n(&demo.local_freelist[cpu], page->next, __ATOMIC_RELAXED);
demo.observed[worker_id] = page;
release(&demo.local_lock[cpu]);     // ← Release own lock
```

### 7.3 Step-by-Step Timeline

```
Initial State:
  CPU 0 local list → P0 → P2 → NULL
  CPU 1 local list → P1 → NULL

Time    CPU 0 (Worker 0)                   CPU 1 (Worker 1)
────    ────────────────                   ────────────────
T1      ─── rendezvous (both ready) ───
T2      acquire(local_lock[0]) ✅          acquire(local_lock[1]) ✅
T3      READ local head → P0              READ local head → P1
T4      WRITE local head = P2             WRITE local head = NULL
T5      release(local_lock[0])            release(local_lock[1])
T6      RETURN P0 ✓                       RETURN P1 ✓

Final State:
  CPU 0 local list → P2 → NULL
  CPU 1 local list → EMPTY
```

### 7.4 Result

| Observation | Value |
|-------------|-------|
| CPU 0 allocated | **P0** |
| CPU 1 allocated | **P1** (different page) |
| CPU 0 local list after | P2 |
| CPU 1 local list after | EMPTY |
| Pages appearing exactly once | 3 / 3 (all pages) |
| Duplicate allocation | **NO** |
| Invariant | **CONSISTENT** ✅ |

> [!NOTE]
> **Key difference from Method 1:** Both CPUs acquire their locks **simultaneously** at T2 — neither blocks the other! This is zero-contention allocation. In the spinlock method, CPU 1 had to wait (spin) until CPU 0 released the shared lock.

---

## 8. How the User Program Orchestrates the Test

```c
// user/racetest.c — Main flow

int main(void) {
    // CASE 1: Run WITHOUT lock
    int unsafe_ok = run_case(UNLOCKED);     // Expected: INCONSISTENT

    // CASE 2: Run WITH spinlock (Method 1)
    int safe_ok = run_case(SPINLOCK);       // Expected: CONSISTENT

    // CASE 3: Run WITH per-CPU lists (Method 2)
    int percpu_ok = run_case(PERCPU);       // Expected: CONSISTENT

    // Final verdict
    if (unsafe_ok && safe_ok && percpu_ok)
        printf("XV6 RACE DEMO: PASS (race reproduced; both fixes preserve ownership)");
}
```

Each `run_case()` does:
1. **`raceinit(mode)`** — Reset the test list (shared or per-CPU depending on mode)
2. **`fork()` × 2** — Create two child processes (scheduled on two CPUs)
3. Each child calls **`raceworker(id)`** — Enters the kernel test
4. Parent calls **`wait()` × 2** — Waits for both children
5. **`racereport()`** — Kernel prints the audit results

---

## 9. Program Output

```
Case Study 14: xv6 kernel free-list race demonstration
Run xv6 with two harts (make qemu CPUS=2).

racetest: starting unlocked case with two xv6 processes

[xv6 race demo] UNLOCKED free-list pop
  user workers ran on harts 0 and 1
  head values read: P0 and P0
  allocated pages: P0 and P0
  same page returned twice: YES
  free-list head after both pops: P1
  page IDs appearing exactly once: 2 / 3
  invariant: INCONSISTENT
  xv6 check: PASS

racetest: starting spinlock case with two xv6 processes

[xv6 race demo] SPINLOCK free-list pop
  user workers ran on harts 0 and 1
  allocated pages: P0 and P1
  same page returned twice: NO
  free-list head after both pops: P2
  page IDs appearing exactly once: 3 / 3
  invariant: CONSISTENT
  xv6 check: PASS

racetest: starting per-CPU free-list case with two xv6 processes

[xv6 race demo] PER-CPU free-list pop
  user workers ran on harts 0 and 1
  allocated pages: P0 and P1
  same page returned twice: NO
  local list heads after both pops: CPU 0=P2, CPU 1=EMPTY
  page IDs appearing exactly once: 3 / 3
  invariant: CONSISTENT
  xv6 check: PASS

XV6 RACE DEMO: PASS (race reproduced; both fixes preserve ownership)
```

---

## 10. Comparison Tables

### Table 1: Unlocked vs Method 1 (Spinlock) vs Method 2 (Per-CPU)

| Criteria | Without Lock | Method 1: Spinlock | Method 2: Per-CPU Lists |
|----------|-------------|-------------------|------------------------|
| CPU 0 gets | P0 | P0 | P0 |
| CPU 1 gets | P0 (duplicate!) | P1 (unique) | P1 (unique) |
| Free list after | P1 → P2 | P2 | CPU0=P2, CPU1=EMPTY |
| Duplicate allocation | **YES** | **NO** | **NO** |
| Pages counted once | 2 / 3 | 3 / 3 | 3 / 3 |
| Data integrity | **INCONSISTENT** ❌ | **CONSISTENT** ✅ | **CONSISTENT** ✅ |
| Real-world impact | Memory corruption | Safe allocation | Safe + scalable |

### Table 2: Method 1 vs Method 2 — Detailed Comparison

| Criteria | Method 1: Spinlock | Method 2: Per-CPU Lists |
|----------|-------------------|------------------------|
| Mechanism | Single global `acquire()`/`release()` | Per-CPU lock + separate list per CPU |
| Lock granularity | Coarse (one lock for entire free list) | Fine (one lock per CPU's list) |
| Contention | High — all CPUs compete for one lock | None for local allocations |
| Blocking | Loser spins until winner releases | No blocking for local pops |
| Scalability | Poor with many CPUs | Excellent — scales linearly |
| Cross-CPU case | N/A | Steal from donor under donor's lock |
| Complexity | Simple | More complex (list partitioning + stealing) |
| Production use | Baseline approach | **XV6's actual `kalloc.c` uses this** |

---

## 11. How to Build and Run

```bash
# Step 1: Open WSL Ubuntu
wsl -d Ubuntu-24.04

# Step 2: Navigate to the project
cd "/mnt/c/Users/HP/Documents/OS record/OS CASE STUDY/case_study_14_rebuild/xv6-riscv"

# Step 3: Build and boot XV6 with 2 CPUs
make clean
make -j4 DETFLAGS= qemu CPUS=2

# Step 4: At the XV6 shell prompt, type:
racetest

# Step 5: Exit QEMU — press Ctrl+A, release, then press X
```

---

## 12. Conclusion

| Objective | Achieved |
|-----------|----------|
| Understand race conditions and critical sections | ✅ Demonstrated with two CPUs reading same head pointer |
| Identify shared kernel data structures | ✅ `kmem[NCPU].freelist` in `kalloc.c` |
| Study the need for mutual exclusion | ✅ Without it, duplicate page allocation occurs |
| Observe the effect of concurrent updates | ✅ UNLOCKED case shows P0 returned to both CPUs |
| Fix using Method 1 (spinlock) | ✅ Global lock serializes access → CONSISTENT |
| Fix using Method 2 (per-CPU lists) | ✅ Partitioned lists eliminate contention → CONSISTENT |
| Compare two synchronization approaches | ✅ Spinlock is simple; per-CPU lists scale better |

**Key Takeaway:** A race condition arises when the **read** and **update** of shared data are not protected as a single atomic operation. XV6 provides two approaches:
1. **Spinlock** (`acquire()`/`release()`) enforces mutual exclusion — simple but creates contention.
2. **Per-CPU free lists** partition the data so each CPU works independently — scalable and used in production.

Both methods prevent data inconsistency. The choice depends on the trade-off between simplicity and performance.

---

*Implemented and tested on XV6 RISC-V with QEMU (2 harts)*
