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
        repo = Repo(path)
        if repo_url:
            try:
                names = [r.name for r in repo.remotes]
                if 'origin' in names:
                    if repo.remotes.origin.url != repo_url:
                        repo.remotes.origin.set_url(repo_url)
                else:
                    repo.create_remote('origin', repo_url)
            except GitCommandError as e:
                raise GitError("GIT_REMOTE_FAILED", str(e))
        return repo
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


def commit_and_push(path: str, rel_paths: Sequence[str], message: str | None = None, push: bool = True) -> dict:
    repo = Repo(path)
    # Add files
    repo.index.add(list(rel_paths) or ["."])
    if message is None:
        message = "chore: update artifacts"
    new_commit = repo.index.commit(message)
    pushed = False
    if push and repo.remotes:
        try:
            repo.remotes.origin.push()
            pushed = True
        except GitCommandError as e:
            raise GitError("NETWORK_ERROR", str(e))
    return {"committed": True, "pushed": pushed, "commit_sha": new_commit.hexsha}


def repo_status(path: str, branch: str | None = None) -> dict:
    repo = Repo(path)
    if branch is None:
        try:
            branch = repo.active_branch.name
        except TypeError:
            branch = None
    ahead = 0
    behind = 0
    try:
        if repo.remotes:
            repo.remotes.origin.fetch(prune=True)
            if branch:
                local = repo.commit(branch)
                remote_ref = f"origin/{branch}"
                remote = repo.commit(remote_ref)
                # Use rev-list left-right count to compute ahead/behind
                counts = repo.git.rev_list("--left-right", "--count", f"{remote.hexsha}...{local.hexsha}").split()
                if len(counts) == 2:
                    behind = int(counts[0])
                    ahead = int(counts[1])
    except GitCommandError as e:
        raise GitError("NETWORK_ERROR", str(e))
    return {"branch": branch, "ahead": ahead, "behind": behind}


def repo_history(path: str, limit: int = 20) -> list[dict]:
    repo = Repo(path)
    commits = list(repo.iter_commits(max_count=limit))
    out: list[dict] = []
    for c in commits:
        out.append({
            "sha": c.hexsha,
            "author": c.author.name if c.author else None,
            "message": c.message.strip(),
            "date": c.committed_datetime,
        })
    return out
