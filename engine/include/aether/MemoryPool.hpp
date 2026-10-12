#pragma once
// Fixed-capacity object pool addressed by 32-bit index. All storage is
// reserved up front; acquire/release are O(1) free-list operations.

#include <cstdint>
#include <memory>

namespace aether {

inline constexpr std::uint32_t kNil = 0xFFFF'FFFFu;

template <class T>
class IndexPool {
 public:
  explicit IndexPool(std::uint32_t capacity)
      : cap_(capacity), slots_(std::make_unique<T[]>(capacity)),
        next_free_(std::make_unique<std::uint32_t[]>(capacity)) {
    reset();
  }

  void reset() noexcept {
    for (std::uint32_t i = 0; i < cap_; ++i) next_free_[i] = (i + 1 < cap_) ? i + 1 : kNil;
    free_head_ = cap_ ? 0 : kNil;
    used_ = 0;
  }

  std::uint32_t acquire() noexcept {
    const std::uint32_t i = free_head_;
    if (i == kNil) return kNil;
    free_head_ = next_free_[i];
    ++used_;
    return i;
  }

  void release(std::uint32_t i) noexcept {
    next_free_[i] = free_head_;
    free_head_ = i;
    --used_;
  }

  T& operator[](std::uint32_t i) noexcept { return slots_[i]; }
  const T& operator[](std::uint32_t i) const noexcept { return slots_[i]; }

  std::uint32_t capacity() const noexcept { return cap_; }
  std::uint32_t used() const noexcept { return used_; }
  std::size_t bytes_reserved() const noexcept { return std::size_t(cap_) * (sizeof(T) + sizeof(std::uint32_t)); }

 private:
  std::uint32_t cap_;
  std::unique_ptr<T[]> slots_;
  std::unique_ptr<std::uint32_t[]> next_free_;
  std::uint32_t free_head_ = kNil;
  std::uint32_t used_ = 0;
};

}  // namespace aether
