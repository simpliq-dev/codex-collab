import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import {
  AgentTarget,
  bytesEqual,
  installationSummary,
  InstallationState,
  shouldOfferSkillInstallation,
  skillDirectoriesForTarget,
} from "./installModel";

const SKILL_NAME = "markdown-collab";
const OFFER_STATE_KEY = "markdownCollab.skillOfferDismissedVersion";

type InstallScope = "user" | "workspace";

type SkillDestination = {
  label: string;
  directory: vscode.Uri;
  file: vscode.Uri;
};

let offerInProgress = false;
let outputChannel: vscode.OutputChannel | undefined;

export function registerAgentSkillInstaller(
  context: vscode.ExtensionContext
): vscode.Disposable {
  outputChannel = vscode.window.createOutputChannel("Markdown Collab");
  const command = vscode.commands.registerCommand(
    "codexCollab.installAgentSkill",
    async () => {
      try {
        await installAgentSkill(context);
      } catch (error) {
        await reportAgentSkillError(error);
      }
    }
  );
  return vscode.Disposable.from(command, outputChannel);
}

export async function reportAgentSkillError(error: unknown): Promise<void> {
  const detail =
    error instanceof Error ? error.stack ?? error.message : String(error);
  outputChannel?.appendLine(`[Agent skill] ${detail}`);
  const choice = await vscode.window.showErrorMessage(
    "Markdown Collab could not install or inspect the agent skill. Run Install Agent Skill again after checking the details.",
    "Show output"
  );
  if (choice === "Show output") {
    outputChannel?.show(true);
  }
}

export async function maybeOfferAgentSkill(
  context: vscode.ExtensionContext
): Promise<void> {
  if (offerInProgress) {
    return;
  }

  const bundled = await readBundledSkill(context);
  const installationState = await inspectKnownInstallations(bundled);
  if (!shouldOfferSkillInstallation(installationState)) {
    return;
  }
  if (
    context.globalState.get<string>(OFFER_STATE_KEY) ===
    context.extension.packageJSON.version
  ) {
    return;
  }

  offerInProgress = true;
  try {
    const message =
      installationState.stale > 0
        ? "An installed Markdown Collab agent skill differs from this extension. Review the skill setup?"
        : "Install the Markdown Collab agent skill so your coding agent can process submitted conversations safely?";
    const choice = await vscode.window.showInformationMessage(
      message,
      "Install skill",
      "Not now"
    );
    if (choice === "Install skill") {
      await installAgentSkill(context);
    } else {
      await context.globalState.update(
        OFFER_STATE_KEY,
        context.extension.packageJSON.version
      );
    }
  } finally {
    offerInProgress = false;
  }
}

export async function installAgentSkill(
  context: vscode.ExtensionContext
): Promise<void> {
  const scope = await chooseScope();
  if (!scope) {
    return;
  }

  const workspaceFolder =
    scope === "workspace" ? await chooseWorkspaceFolder() : undefined;
  if (scope === "workspace" && !workspaceFolder) {
    return;
  }

  const target = await chooseAgentTarget();
  if (!target) {
    return;
  }

  const destinations = skillDestinations(scope, target, workspaceFolder);
  const bundled = await readBundledSkill(context);
  const conflicts: SkillDestination[] = [];

  for (const destination of destinations) {
    const existing = await tryReadFile(destination.file);
    if (existing && !bytesEqual(existing, bundled)) {
      conflicts.push(destination);
    }
  }

  if (conflicts.length > 0) {
    const paths = conflicts.map((item) => item.file.fsPath).join("\n");
    const choice = await vscode.window.showWarningMessage(
      "A different Markdown Collab skill already exists.",
      {
        modal: true,
        detail: `${paths}\n\nReplace only the SKILL.md file? Other files in the skill folder will be left unchanged.`,
      },
      "Replace SKILL.md"
    );
    if (choice !== "Replace SKILL.md") {
      return;
    }
  }

  const installed: string[] = [];
  const current: string[] = [];
  for (const destination of destinations) {
    const existing = await tryReadFile(destination.file);
    if (existing && bytesEqual(existing, bundled)) {
      current.push(destination.label);
      continue;
    }
    await vscode.workspace.fs.createDirectory(destination.directory);
    await vscode.workspace.fs.writeFile(destination.file, bundled);
    installed.push(destination.label);
  }

  await context.globalState.update(
    OFFER_STATE_KEY,
    context.extension.packageJSON.version
  );

  const summary = installationSummary(installed, current);
  await vscode.window.showInformationMessage(
    `${summary} Start a new agent conversation if the skill is not available immediately.`
  );
}

async function chooseScope(): Promise<InstallScope | undefined> {
  const choice = await vscode.window.showQuickPick(
    [
      {
        label: "User profile",
        description: "Recommended",
        detail: "Use Markdown Collab from any project opened by this agent.",
        value: "user" as const,
      },
      {
        label: "Current workspace",
        description: "Project-local",
        detail:
          "Create reviewable skill files in this workspace so they can be shared with the project.",
        value: "workspace" as const,
      },
    ],
    {
      title: "Install the Markdown Collab agent skill",
      placeHolder: "Choose where the skill should be available",
    }
  );
  return choice?.value;
}

async function chooseWorkspaceFolder(): Promise<
  vscode.WorkspaceFolder | undefined
> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 0) {
    await vscode.window.showErrorMessage(
      "Open a folder or workspace before installing a project-local skill."
    );
    return undefined;
  }
  if (folders.length === 1) {
    return folders[0];
  }
  const choice = await vscode.window.showQuickPick(
    folders.map((folder) => ({
      label: folder.name,
      description: folder.uri.fsPath,
      folder,
    })),
    {
      title: "Choose a workspace folder",
      placeHolder: "The skill will be created inside this folder",
    }
  );
  return choice?.folder;
}

async function chooseAgentTarget(): Promise<AgentTarget | undefined> {
  const choice = await vscode.window.showQuickPick(
    [
      {
        label: "Codex and Cursor",
        description: ".agents/skills",
        detail: "Install the shared Agent Skills version used by Codex and Cursor.",
        value: "agents" as const,
      },
      {
        label: "Claude Code",
        description: ".claude/skills",
        detail: "Install the skill in Claude Code's skill directory.",
        value: "claude" as const,
      },
      {
        label: "Codex, Cursor, and Claude Code",
        description: "Both locations",
        detail: "Install identical copies for all three supported agent harnesses.",
        value: "both" as const,
      },
    ],
    {
      title: "Choose your agent harness",
      placeHolder: "Markdown Collab never sends prompts to the agent itself",
    }
  );
  return choice?.value;
}

function skillDestinations(
  scope: InstallScope,
  target: AgentTarget,
  workspaceFolder?: vscode.WorkspaceFolder
): SkillDestination[] {
  const root =
    scope === "workspace"
      ? workspaceFolder?.uri
      : vscode.Uri.file(os.homedir());
  if (!root) {
    return [];
  }

  const destinations: SkillDestination[] = [];
  destinations.push(
    ...skillDirectoriesForTarget(target).map((item) =>
      destination(root, item.hostDirectory, item.label)
    )
  );
  return destinations;
}

function destination(
  root: vscode.Uri,
  hostDirectory: string,
  label: string
): SkillDestination {
  const directory = vscode.Uri.joinPath(
    root,
    hostDirectory,
    "skills",
    SKILL_NAME
  );
  return {
    label,
    directory,
    file: vscode.Uri.joinPath(directory, "SKILL.md"),
  };
}

async function readBundledSkill(
  context: vscode.ExtensionContext
): Promise<Uint8Array> {
  const uri = vscode.Uri.joinPath(
    context.extensionUri,
    "skills",
    SKILL_NAME,
    "SKILL.md"
  );
  return vscode.workspace.fs.readFile(uri);
}

async function inspectKnownInstallations(
  bundled: Uint8Array
): Promise<InstallationState> {
  const state: InstallationState = { current: 0, stale: 0 };
  for (const destination of knownDestinations()) {
    const existing = await tryReadFile(destination.file);
    if (!existing) {
      continue;
    }
    if (bytesEqual(existing, bundled)) {
      state.current += 1;
    } else {
      state.stale += 1;
    }
  }
  return state;
}

function knownDestinations(): SkillDestination[] {
  const roots = [vscode.Uri.file(path.resolve(os.homedir()))];
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    roots.push(folder.uri);
  }
  return roots.flatMap((root) => [
    destination(root, ".agents", "Codex and Cursor skill"),
    destination(root, ".claude", "Claude Code skill"),
  ]);
}

async function tryReadFile(uri: vscode.Uri): Promise<Uint8Array | undefined> {
  try {
    return await vscode.workspace.fs.readFile(uri);
  } catch (error) {
    if (error instanceof vscode.FileSystemError && error.code === "FileNotFound") {
      return undefined;
    }
    throw error;
  }
}
