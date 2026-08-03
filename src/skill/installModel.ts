export type AgentTarget = "agents" | "claude" | "both";

export type InstallationState = {
  current: number;
  stale: number;
};

export type SkillDirectory = {
  hostDirectory: ".agents" | ".claude";
  label: string;
};

export function skillDirectoriesForTarget(
  target: AgentTarget
): SkillDirectory[] {
  const directories: SkillDirectory[] = [];
  if (target === "agents" || target === "both") {
    directories.push({
      hostDirectory: ".agents",
      label: "Codex and Cursor skill",
    });
  }
  if (target === "claude" || target === "both") {
    directories.push({
      hostDirectory: ".claude",
      label: "Claude Code skill",
    });
  }
  return directories;
}

export function shouldOfferSkillInstallation(
  state: InstallationState
): boolean {
  return state.stale > 0 || state.current === 0;
}

export function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

export function installationSummary(
  installed: string[],
  current: string[]
): string {
  if (installed.length === 0) {
    return `${current.join(" and ")} already up to date.`;
  }
  if (current.length === 0) {
    return `${installed.join(" and ")} installed.`;
  }
  return `${installed.join(" and ")} installed; ${current.join(
    " and "
  )} already up to date.`;
}
