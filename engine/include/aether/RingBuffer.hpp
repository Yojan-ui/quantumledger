#pragma once
// Bounded single-producer / single-consumer lock-free ring buffer.
// Storage is allocated once at construction; push/pop never allocate.

#include <atomic>
#include <cstddef>
#include <memory>
#include <new>
#include <type_traits>

namespace aether {

inline constexpr std::size_t kCacheLine = 64;

template <class T>
class SpscRing {
  static_assert(std::is_trivially_copyable_v<T>, "ring elements must be trivially copyable");

 public:
  explicit SpscRing(std::size_t capacity_pow2)
      : mask_(capacity_pow2 - 1), buf_(std::make_unique<T[]>(capacity_pow2)) {
    // capacity must be a power of two so the index wrap is a mask
    if (capacity_pow2 == 0 || (capacity_pow2 & mask_) != 0) throw std::bad_array_new_length();
  }

  bool try_push(const T& v) noexcept {
    const std::size_t h = head_.load(std::memory_order_relaxed);
    if (h - tail_cache_ > mask_) {
      tail_cache_ = tail_.load(std::memory_order_acquire);
      if (h - tail_cache_ > mask_) return false;
    }
    buf_[h & mask_] = v;
    head_.store(h + 1, std::memory_order_release);
    return true;
  }

  bool try_pop(T& out) noexcept {
    const std::size_t t = tail_.load(std::memory_order_relaxed);
    if (t == head_cache_) {
      head_cache_ = head_.load(std::memory_order_acquire);
      if (t == head_cache_) return false;
    }
    out = buf_[t & mask_];
    tail_.store(t + 1, std::memory_order_release);
    return true;
  }

  std::size_t size_approx() const noexcept {
    return head_.load(std::memory_order_acquire) - tail_.load(std::memory_order_acquire);
  }
  std::size_t capacity() const noexcept { return mask_ + 1; }

 private:
  const std::size_t mask_;
  std::unique_ptr<T[]> buf_;
  alignas(kCacheLine) std::atomic<std::size_t> head_{0};
  std::size_t tail_cache_ = 0;   // producer-local
  alignas(kCacheLine) std::atomic<std::size_t> tail_{0};
  std::size_t head_cache_ = 0;   // consumer-local
};

}  // namespace aether
