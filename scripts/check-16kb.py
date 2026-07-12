#!/usr/bin/env python3
"""Check Android native libraries (.so) for 16 KB page-size compliance.

Google Play (Nov 2025+) requires 64-bit native libs to be aligned to 16 KB.
This reads each ELF's PT_LOAD program headers and verifies the max p_align is
>= 16384 (0x4000) for 64-bit ABIs. 32-bit ABIs are exempt (reported, not failed).

Usage:
  # On a release build's extracted libs (unzip the .aab/.apk first):
  python scripts/check-16kb.py path/to/base/lib
  python scripts/check-16kb.py path/to/apk/lib
  # Or a single file:
  python scripts/check-16kb.py path/to/libfoo.so

Exit code is non-zero if any 64-bit .so is NOT 16 KB-aligned.
"""
import struct, sys, os, glob

ABI_IS_64 = {'arm64-v8a': True, 'x86_64': True, 'armeabi-v7a': False, 'x86': False}

def max_load_align(path):
    with open(path, 'rb') as f:
        d = f.read()
    if d[:4] != b'\x7fELF':
        return None
    is64 = d[4] == 2
    end = '<' if d[5] == 1 else '>'
    if is64:
        phoff = struct.unpack_from(end + 'Q', d, 0x20)[0]
        ent = struct.unpack_from(end + 'H', d, 0x36)[0]
        n = struct.unpack_from(end + 'H', d, 0x38)[0]
    else:
        phoff = struct.unpack_from(end + 'I', d, 0x1C)[0]
        ent = struct.unpack_from(end + 'H', d, 0x2A)[0]
        n = struct.unpack_from(end + 'H', d, 0x2C)[0]
    mx = 0
    for i in range(n):
        o = phoff + i * ent
        if struct.unpack_from(end + 'I', d, o)[0] != 1:  # PT_LOAD
            continue
        a = struct.unpack_from(end + 'Q', d, o + 0x30)[0] if is64 \
            else struct.unpack_from(end + 'I', d, o + 0x1C)[0]
        mx = max(mx, a)
    return mx, is64

def abi_of(path):
    for part in path.replace('\\', '/').split('/'):
        if part in ABI_IS_64:
            return part
    return '?'

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    target = sys.argv[1]
    files = [target] if os.path.isfile(target) else sorted(
        glob.glob(os.path.join(target, '**', '*.so'), recursive=True))
    if not files:
        print(f"No .so files found under {target}")
        sys.exit(2)

    failures = 0
    for so in files:
        res = max_load_align(so)
        if res is None:
            continue
        mx, is64 = res
        abi = abi_of(so)
        bit64 = ABI_IS_64.get(abi, is64)
        ok = mx >= 16384
        if bit64 and not ok:
            tag, failures = 'FAIL', failures + 1
        elif bit64:
            tag = 'OK  '
        else:
            tag = 'exem'  # 32-bit, exempt
        print(f"  [{tag}] align={hex(mx):>8}  {abi:12} {os.path.basename(so)}")

    print()
    if failures:
        print(f"=> {failures} 64-bit .so NOT 16 KB-aligned — Play will reject this build.")
        sys.exit(1)
    print("=> All 64-bit .so are 16 KB-aligned. ✓")

if __name__ == '__main__':
    main()
