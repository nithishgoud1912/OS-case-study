#include "kernel/types.h"
#include "user/user.h"

enum { UNLOCKED = 0, SPINLOCK = 1, PERCPU = 2, WORKERS = 2 };

static int
run_case(int mode)
{
  if (raceinit(mode) < 0) {
    printf("racetest: could not initialize the kernel test\n");
    return -1;
  }

  printf("racetest: starting %s case with two xv6 processes\n",
         mode == UNLOCKED ? "unlocked" :
         mode == SPINLOCK ? "spinlock" : "per-CPU free-list");

  int children = 0;
  for (int worker = 0; worker < WORKERS; worker++) {
    int pid = fork();
    if (pid < 0) {
      printf("racetest: fork failed\n");
      return -1;
    }
    if (pid == 0) {
      int result = raceworker(worker);
      exit(result == 0 ? 0 : 1);
    }
    children++;
  }

  for (int i = 0; i < children; i++) {
    int status;
    if (wait(&status) < 0 || status != 0) {
      printf("racetest: worker process failed\n");
      return -1;
    }
  }

  return racereport();
}

int
main(void)
{
  printf("Case Study 14: xv6 kernel free-list race demonstration\n");
  printf("Run xv6 with two harts (make qemu CPUS=2).\n");

  int unsafe_ok = run_case(UNLOCKED) == 0;
  int safe_ok = run_case(SPINLOCK) == 0;
  int percpu_ok = run_case(PERCPU) == 0;

  if (unsafe_ok && safe_ok && percpu_ok) {
    printf("XV6 RACE DEMO: PASS (race reproduced; both fixes preserve ownership)\n");
    exit(0);
  }

  printf("XV6 RACE DEMO: FAIL (see kernel report above)\n");
  exit(1);
}
