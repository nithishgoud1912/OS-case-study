# Case Study 14 — File-by-File Explanation

## How the 5 Open Files Work Together

```mermaid
graph TD
    A["racetest.c<br/>(User Program)"] -->|"syscall: raceinit()"| B["syscall.c<br/>(Dispatch Table)"]
    A -->|"syscall: raceworker()"| B
    A -->|"syscall: racereport()"| B
    B -->|routes to| C["racecheck.c<br/>(Kernel Test Engine)"]
    D["kalloc.c<br/>(Production Allocator)"] -.->|"pattern copied into"| C
    E["GUIDE.md<br/>(Run Instructions)"] -.->|"documents all files"| A
```

---

## 1. [`kalloc.c`](file:///c:/Users/HP/Documents/OS%20record/OS%20CASE%20STUDY/case_study_14_rebuild/xv6-riscv/kernel/kalloc.c) — The Real-World Problem

**Role:** Shows the *production* shared data structure that motivates the entire case study.

### Key shared data (lines 17-24)

```c
struct run {
    struct run *next;          // pointer to next free page
};

struct {
    struct spinlock lock;      // ← the lock that prevents races
    struct run *freelist;      // ← the shared linked list (head pointer)
} kmem[NCPU];                 // one list per CPU
```

> [!NOTE]
> The production allocator uses **per-CPU free lists** (`kmem[NCPU]`). Each CPU has its own `freelist` and `lock`. This reduces contention compared to a single global lock.

### The critical section you're studying — `kalloc()` (lines 80-86)

```c
push_off();
int cpu = cpuid();
acquire(&kmem[cpu].lock);         // ENTER critical section
r = kmem[cpu].freelist;           // Step 1: READ the head
if (r)
    kmem[cpu].freelist = r->next; // Step 2: UPDATE the head
release(&kmem[cpu].lock);         // EXIT critical section
```

> [!IMPORTANT]
> **This is the heart of the case study.** The two steps (read head → update head) MUST be atomic. If two CPUs both execute Step 1 before either does Step 2, they both get the **same page** — a race condition causing duplicate ownership.

### Donor stealing (lines 88-100)

When the local list is empty, `kalloc()` steals a page from another CPU's list:

```c
if (r == 0) {
    for (int donor = 0; donor < NCPU; donor++) {
        if (donor == cpu) continue;
        acquire(&kmem[donor].lock);
        r = kmem[donor].freelist;
        if (r) kmem[donor].freelist = r->next;
        release(&kmem[donor].lock);
        if (r) break;
    }
}
pop_off();
```

`kalloc.c` also shows the same pattern in [`kfree()`](file:///c:/Users/HP/Documents/OS%20record/OS%20CASE%20STUDY/case_study_14_rebuild/xv6-riscv/kernel/kalloc.c#L47-L68) (lines 60-67), where a freed page is pushed onto the **current CPU's** list under that CPU's lock.

---

## 2. [`racecheck.c`](file:///c:/Users/HP/Documents/OS%20record/OS%20CASE%20STUDY/case_study_14_rebuild/xv6-riscv/kernel/racecheck.c) — The Demonstration Engine (⭐ Core File)

**Role:** Implements the **actual experiment** — first showing the inconsistency, then showing how **two different synchronization methods** fix it.

### What it builds (lines 19-35)

A miniature copy of `kalloc.c`'s free list with 3 pages (`P0 → P1 → P2`):

```c
struct race_run {
    int id;                    // 0, 1, or 2
    struct race_run *next;
};

static struct {
    struct spinlock lock;      // xv6's real spinlock (for Method 1)
    struct spinlock local_lock[RACE_WORKERS]; // per-CPU locks (for Method 2)
    struct race_run pages[3];  // the 3 test pages
    struct race_run *freelist; // shared head pointer (like kmem.freelist)
    struct race_run *local_freelist[RACE_WORKERS]; // per-CPU lists (Method 2)
    /* ... per-worker observations and allocations */
} demo;
```

### Three modes are supported

| Mode | Constant | Purpose |
|------|----------|---------|
| Unlocked | `RACE_UNLOCKED = 0` | Demonstrate the race condition |
| Method 1: Spinlock | `RACE_SPINLOCK = 1` | Fix with a single global spinlock |
| Method 2: Per-CPU | `RACE_PERCPU = 2` | Fix with per-CPU free lists (mirrors production `kalloc.c`) |

### 🔴 UNLOCKED path — Demonstrates the INCONSISTENCY (lines 132-141)

```c
// Both workers execute this simultaneously on different CPUs:
page = __atomic_load_n(&demo.freelist, __ATOMIC_RELAXED);  // Both read P0
next = page ? page->next : 0;                               // Both save P1

rendezvous(worker_id);  // ← wait until BOTH have read (forces the race)

if (page)
    __atomic_store_n(&demo.freelist, next, __ATOMIC_RELAXED); // Both write P1
```

**Result:** Both CPUs return `P0`. The head becomes `P1`. But `P0` is now "owned" by two processes — **data inconsistency!**

### 🟢 Method 1: SPINLOCK path — Fix using mutual exclusion (lines 142-149)

```c
rendezvous(worker_id);           // Both CPUs are ready
acquire(&demo.lock);             // ← Only ONE can enter
page = __atomic_load_n(&demo.freelist, __ATOMIC_RELAXED);
if (page)
    __atomic_store_n(&demo.freelist, page->next, __ATOMIC_RELAXED);
release(&demo.lock);             // ← Now the other can enter
```

**Result:** First CPU gets `P0`, second CPU gets `P1`. Head becomes `P2`. Every page owned by exactly one entity — **consistent!**

### 🟢 Method 2: PER-CPU path — Fix using partitioned free lists (lines 150-159)

```c
rendezvous(worker_id);
int cpu = cpuid();
acquire(&demo.local_lock[cpu]);  // ← Each CPU locks its OWN list
page = __atomic_load_n(&demo.local_freelist[cpu], __ATOMIC_RELAXED);
if (page)
    __atomic_store_n(&demo.local_freelist[cpu], page->next, __ATOMIC_RELAXED);
release(&demo.local_lock[cpu]);
```

**Setup:** CPU 0 starts with `P0 → P2`; CPU 1 starts with `P1`. Each worker pops from its **local** list only.

**Result:** CPU 0 gets `P0`, CPU 1 gets `P1`. `P2` remains on CPU 0's list. No contention on a shared head — **consistent!**

> [!TIP]
> **Why two methods?** Method 1 (spinlock) is simpler but creates a bottleneck — all CPUs compete for one lock. Method 2 (per-CPU lists) is what XV6's production `kalloc.c` actually uses. It eliminates contention for the common case where a CPU allocates from its own list. Cross-CPU stealing is still protected by the donor's lock.

### The Audit (lines 167-213)

The [`audit_state()`](file:///c:/Users/HP/Documents/OS%20record/OS%20CASE%20STUDY/case_study_14_rebuild/xv6-riscv/kernel/racecheck.c#L167-L213) function counts how many times each page ID appears. If every page appears **exactly once** across allocations + remaining free list → CONSISTENT. Otherwise → INCONSISTENT.

For the per-CPU case, it scans **both** local free lists instead of the single global list.

---

## 3. [`racetest.c`](file:///c:/Users/HP/Documents/OS%20record/OS%20CASE%20STUDY/case_study_14_rebuild/xv6-riscv/user/racetest.c) — The User-Space Driver

**Role:** The xv6 program the student types at the shell prompt. It orchestrates the experiment.

### Flow (lines 43-59)

```
main()
 ├── run_case(UNLOCKED)     ← run without lock, expect INCONSISTENT
 │   ├── raceinit(0)        ← reset the test list to P0→P1→P2
 │   ├── fork() × 2         ← create 2 child processes (one per CPU)
 │   │   └── raceworker(id) ← each child enters the kernel test
 │   ├── wait() × 2         ← parent waits for both children
 │   └── racereport()       ← print audit results
 │
 ├── run_case(SPINLOCK)     ← Method 1: run with spinlock, expect CONSISTENT
 │   └── (same steps)
 │
 ├── run_case(PERCPU)       ← Method 2: run with per-CPU lists, expect CONSISTENT
 │   └── (same steps)
 │
 └── Print PASS/FAIL
```

> [!NOTE]
> The `fork()` is critical — it creates **two separate xv6 processes** that get scheduled on **two different QEMU harts (CPUs)**. This is real concurrency, not simulated.

---

## 4. [`syscall.c`](file:///c:/Users/HP/Documents/OS%20record/OS%20CASE%20STUDY/case_study_14_rebuild/xv6-riscv/kernel/syscall.c) — The Wiring

**Role:** Connects user-space calls to kernel-space functions.

### What was added (lines 106-108, 136-138)

```c
// Function declarations
extern uint64 sys_raceinit(void);
extern uint64 sys_raceworker(void);
extern uint64 sys_racereport(void);

// Dispatch table entries
[SYS_raceinit]   = sys_raceinit,
[SYS_raceworker] = sys_raceworker,
[SYS_racereport] = sys_racereport,
```

When `racetest.c` calls `raceinit()`, the CPU traps into the kernel, `syscall()` looks up the number in this table, and dispatches to `sys_raceinit()` in `racecheck.c`.

---

## 5. [`GUIDE_Run_and_Explain_Case_Study_14.md`](file:///c:/Users/HP/Documents/OS%20record/OS%20CASE%20STUDY/case_study_14_rebuild/GUIDE_Run_and_Explain_Case_Study_14.md) — The Instructions

**Role:** Step-by-step guide to build and run everything in WSL + QEMU.

| Section | What it covers |
|---------|---------------|
| §1 | Start WSL Ubuntu, install toolchain |
| §2 | `make clean && make qemu CPUS=2` |
| §3 | Type `racetest` at xv6 shell |
| §4 | Expected output: UNLOCKED (INCONSISTENT) → SPINLOCK (CONSISTENT) → PER-CPU (CONSISTENT) |
| §5 | Code walkthrough snippets for all three cases |
| §6 | How to present in PPT/report |

---

## How This Maps to Your Sir's Requirements

| Requirement | File(s) | What to show |
|------------|---------|-------------|
| **Identify shared data structure** | `kalloc.c` lines 17-24 | `kmem[NCPU].freelist` — per-CPU physical-page free lists |
| **Demonstrate inconsistency (no lock)** | `racecheck.c` lines 132-141 | Both CPUs get `P0` → INCONSISTENT |
| **Method 1: Spinlock fix** | `racecheck.c` lines 142-149 | xv6 spinlock → each CPU gets a different page → CONSISTENT |
| **Method 2: Per-CPU free lists** | `racecheck.c` lines 150-159 | Separate locked lists per CPU → CONSISTENT (matches production `kalloc.c`) |
| **C code implementation** | `racecheck.c` + `racetest.c` | The full kernel module + user program |
| **Running the code** | `GUIDE.md` §2-§3 | Build in WSL, boot QEMU, type `racetest` |
| **Expected output** | `GUIDE.md` §4 | UNLOCKED=INCONSISTENT, SPINLOCK=CONSISTENT, PER-CPU=CONSISTENT |

---

## The Race Condition Visualized

````carousel
### 🔴 Without Lock (INCONSISTENT)

```
Time ──────────────────────────────►

CPU 0                    CPU 1
─────                    ─────
READ head → P0           READ head → P0      ← both see P0!
SAVE next → P1           SAVE next → P1
   ┌── rendezvous ──┐
WRITE head = P1          WRITE head = P1      ← both write P1
RETURN P0 ✓              RETURN P0 ✗ DUPLICATE!

Free list: P1 → P2
P0 owned by BOTH → 💥 DATA CORRUPTION
```
<!-- slide -->
### 🟢 Method 1: With Spinlock (CONSISTENT)

```
Time ──────────────────────────────►

CPU 0                    CPU 1
─────                    ─────
   ┌── rendezvous ──┐
acquire(lock) ✓          acquire(lock) 🔒 BLOCKED
READ head → P0               │
WRITE head = P1               │ spinning...
release(lock)                 │
                         acquire(lock) ✓
                         READ head → P1
                         WRITE head = P2
                         release(lock)
RETURN P0 ✓              RETURN P1 ✓

Free list: P2
Every page owned ONCE → ✅ CONSISTENT
```
<!-- slide -->
### 🟢 Method 2: Per-CPU Free Lists (CONSISTENT)

```
Time ──────────────────────────────►

CPU 0                    CPU 1
─────                    ─────
Local list: P0→P2        Local list: P1
   ┌── rendezvous ──┐
acquire(local_lock[0])   acquire(local_lock[1])
READ local head → P0     READ local head → P1
WRITE local head = P2    WRITE local head = NULL
release(local_lock[0])   release(local_lock[1])
RETURN P0 ✓              RETURN P1 ✓

CPU 0 list: P2           CPU 1 list: EMPTY
No shared head → Zero contention → ✅ CONSISTENT
```
````

---

## Method 1 vs Method 2 — Comparison

| Criteria | Method 1: Spinlock | Method 2: Per-CPU Lists |
|----------|-------------------|------------------------|
| Mechanism | Single global lock (`acquire`/`release`) | Per-CPU lock + separate list per CPU |
| Contention | All CPUs compete for one lock | Zero contention for local allocations |
| Pages returned | P0 and P1 (sequential) | P0 and P1 (from separate lists) |
| Invariant | CONSISTENT ✅ | CONSISTENT ✅ |
| Production use | Simple but doesn't scale | **Used by XV6's actual `kalloc.c`** |
| Cross-CPU case | N/A (single list) | Steal from donor under donor's lock |
