cmake_minimum_required(VERSION 3.21)
project(aetherpool_engine VERSION 0.1.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)   # liboqs is linked into the Python ctypes .dylib too
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release CACHE STRING "" FORCE)
endif()

option(AETHER_USE_SYSTEM_LIBOQS "Use an installed liboqs (find_package) instead of fetching it" OFF)

# ---------------------------------------------------------------------------
# liboqs — NIST FIPS 203 (ML-KEM) + FIPS 204 (ML-DSA) reference/optimised impls.
# Minimal build: only the four parameter sets this engine uses.
# ---------------------------------------------------------------------------
if(AETHER_USE_SYSTEM_LIBOQS)
  find_package(liboqs REQUIRED)
  set(AETHER_OQS_TARGET OQS::oqs)
else()
  include(FetchContent)
  set(OQS_MINIMAL_BUILD "KEM_ml_kem_768;KEM_ml_kem_1024;SIG_ml_dsa_65;SIG_ml_dsa_87" CACHE STRING "" FORCE)
  set(OQS_BUILD_ONLY_LIB ON CACHE BOOL "" FORCE)
  set(OQS_USE_OPENSSL OFF CACHE BOOL "" FORCE)
  set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
  set(CMAKE_POLICY_VERSION_MINIMUM 3.5 CACHE STRING "" FORCE)
  FetchContent_Declare(liboqs
    GIT_REPOSITORY https://github.com/open-quantum-safe/liboqs.git
    GIT_TAG        0.14.0
    GIT_SHALLOW    TRUE)
  FetchContent_MakeAvailable(liboqs)
  set(AETHER_OQS_TARGET oqs)
  # liboqs stages its public headers (<oqs/oqs.h>) into its binary dir at configure time
  set(AETHER_OQS_INCLUDE ${liboqs_BINARY_DIR}/include)
endif()

set(AETHER_WARNINGS -Wall -Wextra -Wpedantic -Wshadow -Wconversion -Wno-sign-conversion)

# ---------------------------------------------------------------------------
# Core library: order book + PQC verification layer + classical baseline
# ---------------------------------------------------------------------------
add_library(aether_core STATIC
  src/OrderBook.cpp
  src/PqcEngine.cpp
  src/ClassicalBaseline.cpp)
target_include_directories(aether_core PUBLIC include ${AETHER_OQS_INCLUDE})
target_link_libraries(aether_core PUBLIC ${AETHER_OQS_TARGET})
target_compile_options(aether_core PRIVATE ${AETHER_WARNINGS})
# Classical baseline backend: OpenSSL 3 if available (set OPENSSL_ROOT_DIR, e.g.
# $(brew --prefix openssl@3)), otherwise Security.framework on macOS.
find_package(OpenSSL 3.0 COMPONENTS Crypto)
if(OpenSSL_FOUND)
  message(STATUS "Classical baseline: OpenSSL ${OPENSSL_VERSION} (${OPENSSL_CRYPTO_LIBRARY})")
  target_compile_definitions(aether_core PRIVATE AETHER_HAVE_OPENSSL=1)
  target_link_libraries(aether_core PUBLIC OpenSSL::Crypto)
elseif(APPLE)
  message(STATUS "Classical baseline: Security.framework (OpenSSL 3 not found)")
  target_link_libraries(aether_core PUBLIC "-framework Security" "-framework CoreFoundation")
endif()

# Engine process: TCP bridge on 127.0.0.1:9001
add_executable(aether_engine src/Bridge.cpp)
target_link_libraries(aether_engine PRIVATE aether_core)
target_compile_options(aether_engine PRIVATE ${AETHER_WARNINGS})
find_package(Threads REQUIRED)
target_link_libraries(aether_engine PRIVATE Threads::Threads)

# C ABI shared library consumed by the Python bridge via ctypes (signing, ML-KEM)
add_library(aetherpqc SHARED src/capi.cpp)
target_link_libraries(aetherpqc PRIVATE aether_core)
target_compile_options(aetherpqc PRIVATE ${AETHER_WARNINGS})

# Tests
enable_testing()
add_executable(test_orderbook tests/test_orderbook.cpp)
target_link_libraries(test_orderbook PRIVATE aether_core)
add_test(NAME orderbook COMMAND test_orderbook)

add_executable(test_pqc tests/test_pqc.cpp)
target_link_libraries(test_pqc PRIVATE aether_core)
add_test(NAME pqc COMMAND test_pqc)
