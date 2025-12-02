#!/usr/bin/env python3
import os
import sys
import hashlib
import shutil
import argparse
from typing import Dict, List, Tuple

# Default file extensions considered "books"
DEFAULT_EXTS = [".epub", ".mobi", ".pdf", ".azw3", ".azw", ".fb2", ".djvu"]

def is_book_file(filename: str, exts: List[str]) -> bool:
    filename_lower = filename.lower()
    return any(filename_lower.endswith(ext) for ext in exts)


def iter_files(root: str) -> List[str]:
    """Return a list of all files under root (recursive)."""
    paths = []
    for dirpath, dirnames, filenames in os.walk(root):
        for f in filenames:
            paths.append(os.path.join(dirpath, f))
    return paths


def safe_move(src: str, dest_dir: str) -> str:
    """
    Move file from src into dest_dir safely:
    - If same name exists and content is identical -> delete src.
    - If same name exists but different content -> rename with suffix.
    Returns final destination path (or original path if deleted as duplicate).
    """
    filename = os.path.basename(src)
    dest_path = os.path.join(dest_dir, filename)

    if not os.path.exists(dest_path):
        # Simple move
        os.makedirs(dest_dir, exist_ok=True)
        shutil.move(src, dest_path)
        return dest_path

    # Target name exists - check if duplicate (same content)
    if files_identical(src, dest_path):
        print(f"[DUPLICATE-MOVE] '{src}' is identical to '{dest_path}', deleting source.")
        os.remove(src)
        return dest_path

    # Different content: create a unique name
    name, ext = os.path.splitext(filename)
    counter = 1
    while True:
        candidate = f"{name} ({counter}){ext}"
        candidate_path = os.path.join(dest_dir, candidate)
        if not os.path.exists(candidate_path):
            print(f"[RENAME-MOVE] Name conflict. Moving '{src}' -> '{candidate_path}'")
            shutil.move(src, candidate_path)
            return candidate_path
        counter += 1


def files_identical(path1: str, path2: str, chunk_size: int = 1024 * 1024) -> bool:
    """Return True if files have identical content."""
    if os.path.getsize(path1) != os.path.getsize(path2):
        return False
    with open(path1, "rb") as f1, open(path2, "rb") as f2:
        while True:
            b1 = f1.read(chunk_size)
            b2 = f2.read(chunk_size)
            if not b1 and not b2:
                return True
            if b1 != b2:
                return False


def remove_empty_dirs(root: str) -> None:
    """Remove empty directories under root (not root itself)."""
    for dirpath, dirnames, filenames in os.walk(root, topdown=False):
        if dirpath == root:
            continue
        if not dirnames and not filenames:
            print(f"[RMDIR] Removing empty directory: {dirpath}")
            try:
                os.rmdir(dirpath)
            except OSError as e:
                print(f"  Could not remove {dirpath}: {e}")


def hash_file(path: str, chunk_size: int = 1024 * 1024) -> str:
    """Compute SHA256 hash for a file."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def find_duplicates_in_dir(root: str, exts: List[str]) -> Dict[str, List[str]]:
    """Find duplicate files (by content) inside root, restricted to given extensions."""
    # First group by size to avoid hashing everything unnecessarily
    size_map: Dict[int, List[str]] = {}
    print("[SCAN] Scanning for potential duplicates...")
    for path in iter_files(root):
        if not is_book_file(path, exts):
            continue
        size = os.path.getsize(path)
        size_map.setdefault(size, []).append(path)

    # Now hash files in size groups where there are 2+ files
    hash_map: Dict[str, List[str]] = {}
    for size, paths in size_map.items():
        if len(paths) < 2:
            continue
        print(f"[SIZE-GROUP] {size} bytes: {len(paths)} files, hashing...")
        for p in paths:
            try:
                file_hash = hash_file(p)
            except Exception as e:
                print(f"  [ERROR] Could not hash '{p}': {e}")
                continue
            hash_map.setdefault(file_hash, []).append(p)

    # Filter out hashes that only have one file
    duplicates = {h: ps for h, ps in hash_map.items() if len(ps) > 1}
    return duplicates


def prompt_and_delete_duplicates(duplicates: Dict[str, List[str]]) -> None:
    """Interactively ask you which duplicates to delete."""
    if not duplicates:
        print("[DUPES] No duplicates found. 🎉")
        return

    print("\n[DUPES] Duplicate sets found:")
    set_num = 1
    for file_hash, paths in duplicates.items():
        print(f"\n=== Duplicate set #{set_num} (hash {file_hash[:12]}...) ===")
        for i, p in enumerate(paths, start=1):
            print(f"  {i}. {p}")
        print("\nOptions:")
        print("  - Enter numbers to DELETE, separated by spaces (e.g. `2 3`)")
        print("  - Enter `a` to delete ALL BUT the first file")
        print("  - Just press ENTER to skip this set")
        choice = input("Your choice for this set: ").strip()

        if not choice:
            print("  Skipping this set.")
            set_num += 1
            continue

        to_delete: List[int] = []
        if choice.lower() == "a":
            to_delete = list(range(2, len(paths) + 1))  # keep file 1
        else:
            try:
                nums = [int(x) for x in choice.split()]
                to_delete = [n for n in nums if 1 <= n <= len(paths)]
            except ValueError:
                print("  Invalid input, skipping this set.")
                set_num += 1
                continue

        for idx in sorted(to_delete, reverse=True):
            path = paths[idx - 1]
            try:
                print(f"  [DELETE] {path}")
                os.remove(path)
            except Exception as e:
                print(f"    Could not delete '{path}': {e}")

        set_num += 1

    print("\n[DUPES] Duplicate review complete.")


def flatten_directories(root: str, exts: List[str]) -> None:
    """
    Move all book files from subdirectories into root, then remove empty dirs.
    """
    print(f"[FLATTEN] Moving book files into parent directory: {root}")
    all_files = iter_files(root)
    for path in all_files:
        if not is_book_file(path, exts):
            continue
        dirpath = os.path.dirname(path)
        if os.path.abspath(dirpath) == os.path.abspath(root):
            continue  # already in root
        safe_move(path, root)

    print("[FLATTEN] Done moving files. Cleaning up empty directories...")
    remove_empty_dirs(root)
    print("[FLATTEN] Done.")


def main():
    parser = argparse.ArgumentParser(
        description="Flatten book directories, remove empty folders, and interactively delete duplicate books."
    )
    parser.add_argument(
        "root",
        help="Parent directory containing book subdirectories and where all books should end up.",
    )
    parser.add_argument(
        "--ext",
        nargs="*",
        default=DEFAULT_EXTS,
        help=f"File extensions to treat as books (default: {', '.join(DEFAULT_EXTS)})",
    )
    args = parser.parse_args()

    root = os.path.abspath(args.root)
    if not os.path.isdir(root):
        print(f"Error: '{root}' is not a directory.")
        sys.exit(1)

    print(f"Using root directory: {root}")
    print(f"Book extensions: {', '.join(args.ext)}")

    # Step 1 & 2: Flatten directories
    flatten_directories(root, args.ext)

    # Step 3 & 4: Find and handle duplicates
    duplicates = find_duplicates_in_dir(root, args.ext)
    prompt_and_delete_duplicates(duplicates)


if __name__ == "__main__":
    main()
