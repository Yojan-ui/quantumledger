#pragma once
// Hardware timing + allocation-free log-linear latency histogram.

#include <array>
#include <bit>
#include <cstdint>
#include <cstring>
#include <ctime>

#if defined(__APPLE__)
#include <mach/mach_time.h>
#include <sys/sysctl.h>
#endif
#if defined(__x86_64__)
#include <x86intrin.h>
#endif

namespace aether {

inline std::uint64_t now_ns() noexcept {
#if defined(__APPLE__)
  return clock_gettime_nsec_np(CLOCK_UPTIME_RAW);
#else
  timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return std::uint64_t(ts.tv_sec) * 1'000'000'000ull + std::uint64_t(ts.tv_nsec);
#endif
}

inline std::uint64_t wall_ns() noexcept {
  timespec ts;
  clock_gettime(CLOCK_REALTIME, &ts);
  return std::uint64_t(ts.tv_sec) * 1'000'000'000ull + std::uint64_t(ts.tv_nsec);
}

// Raw hardware counter. On x86-64 this is the TSC (cycles at nominal
// frequency). On Apple silicon user space cannot read the PMU cycle counter and
// direct CNTVCT_EL0 reads are not reliable under macOS, so this is
// mach_absolute_time() (24 MHz timebase) — reported as "ticks", never
// relabelled as cycles.
inline std::uint64_t read_ticks() noexcept {
#if defined(__x86_64__)
  return __rdtsc();
#elif defined(__APPLE__)
  return mach_absolute_time();
#elif defined(__aarch64__)
  std::uint64_t v;
  asm volatile("isb; mrs %0, cntvct_el0" : "=r"(v) :: "memory");
  return v;
#else
  return now_ns();
#endif
}

inline std::uint64_t tick_hz() noexcept {
#if defined(__APPLE__) && defined(__aarch64__)
  mach_timebase_info_data_t tb;
  mach_timebase_info(&tb);
  return tb.numer ? 1'000'000'000ull * tb.denom / tb.numer : 0;
#elif defined(__aarch64__)
  std::uint64_t f;
  asm volatile("mrs %0, cntfrq_el0" : "=r"(f));
  return f;
#else
  return 0;   // TSC rate is not architecturally exposed; caller treats 0 as "cycles"
#endif
}

struct ClockInfo {
  char cpu[96] = "unknown";
  const char* counter = "steady_clock";
  std::uint64_t counter_hz = 0;
  // Peak P-core clock used to estimate cycles from wall time when the cycle
  // counter is not user-readable. 0 == unknown (no estimate is reported).
  double est_core_ghz = 0.0;
};

inline ClockInfo probe_clock() noexcept {
  ClockInfo ci;
#if defined(__APPLE__)
  std::size_t len = sizeof(ci.cpu);
  if (sysctlbyname("machdep.cpu.brand_string", ci.cpu, &len, nullptr, 0) != 0) std::strcpy(ci.cpu, "unknown");
#endif
#if defined(__x86_64__)
  ci.counter = "rdtsc";
#elif defined(__aarch64__)
#if defined(__APPLE__)
  ci.counter = "mach_absolute_time";
#else
  ci.counter = "cntvct_el0";
#endif
  ci.counter_hz = tick_hz();
  // Published peak performance-core clocks for Apple silicon generations.
  struct { const char* tag; double ghz; } table[] = {
      {"M1", 3.2}, {"M2", 3.49}, {"M3", 4.05}, {"M4", 4.4}};
  for (auto& t : table)
    if (std::strstr(ci.cpu, t.tag)) ci.est_core_ghz = t.ghz;
#endif
  return ci;
}

// HDR-style histogram: exact below 32 ns, then 16 linear sub-buckets per
// power of two (~6% relative precision). Single writer; no allocation.
class LatencyHistogram {
 public:
  static constexpr int kSub = 16;
  static constexpr int kBuckets = 32 + 40 * kSub;

  void record(std::uint64_t v) noexcept {
    ++counts_[index(v)];
    ++total_;
    if (v > max_) max_ = v;
    sum_ += v;
  }
  void reset() noexcept { counts_.fill(0); total_ = max_ = sum_ = 0; }

  std::uint64_t count() const noexcept { return total_; }
  std::uint64_t max() const noexcept { return max_; }
  std::uint64_t mean() const noexcept { return total_ ? sum_ / total_ : 0; }

  std::uint64_t percentile(double p) const noexcept {
    if (!total_) return 0;
    const auto target = std::uint64_t(p * double(total_) + 0.5);
    std::uint64_t acc = 0;
    for (int i = 0; i < kBuckets; ++i) {
      acc += counts_[i];
      if (acc >= target && counts_[i]) return value_of(i);
    }
    return max_;
  }

 private:
  static int index(std::uint64_t v) noexcept {
    if (v < 32) return int(v);
    const int e = 63 - std::countl_zero(v);
    const int i = 32 + (e - 5) * kSub + int((v >> (e - 4)) & (kSub - 1));
    return i < kBuckets ? i : kBuckets - 1;
  }
  static std::uint64_t value_of(int i) noexcept {
    if (i < 32) return std::uint64_t(i);
    const int e = (i - 32) / kSub + 5;
    const std::uint64_t sub = std::uint64_t((i - 32) % kSub);
    const std::uint64_t lo = (kSub + sub) << (e - 4);
    return lo + ((1ull << (e - 4)) >> 1);   // bucket midpoint
  }

  std::array<std::uint64_t, kBuckets> counts_{};
  std::uint64_t total_ = 0, max_ = 0, sum_ = 0;
};

}  // namespace aether
