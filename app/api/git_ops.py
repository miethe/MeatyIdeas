from __future__ import annotations

import os
from typing import Sequence

from git import Repo, GitCommandError


class GitError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def ensure_repo(path: str, repo_url: str | None = None) -> Repo:
    os.makedirs(path, exist_ok=True)
    if (os.path.isdir(os.path.join(path, ".git"))):
        return Repo(path)
    if repo_url:
        try:
            return Repo.clone_from(repo_url, path)
        except GitCommandError as e:
            raise GitError("GIT_CLONE_FAILED", str(e))
    # init local
    repo = Repo.init(path)
    # ensure one commit for empty repo
    if not repo.head.is_valid():
        dummy = os.path.join(path, ".gitkeep")
        open(dummy, "a").close()
        repo.index.add([".gitkeep"])
        repo.index.commit("chore: init artifacts repo")
    return repo


def commit_and_push(path: str, rel_paths: Sequence[str], message: str | None = None) -> dict:
    repo = Repo(path)
    # Add files
    repo.index.add(list(rel_paths) or ["."])
    if message is None:
        message = "chore: update artifacts"
    repo.index.commit(message)
    # Try push if remote exists
    try:
        if repo.remotes:
            repo.remotes.origin.push()
        pushed = True if repo.remotes else False
    except GitCommandError as e:
        # map to typed error codes if needed
        raise GitError("NETWORK_ERROR", str(e))
    return {"committed": True, "pushed": pushed}

