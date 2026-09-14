import { Alert, Box, Group, Modal, Stack, Text } from '@mantine/core'
import { useBridge, useTheme } from '@starhive/bridge'
import { Button, Select, TextInput } from '@starhive/ui'
import { useEffect, useState } from 'react'

import { branchNameProblem, MAX_BRANCH_NAME } from './codeLink'
import { CopyField } from './CopyField'
import { type CodeState, gitlab } from './providers'

/**
 * Name a branch, then either let GitLab create it or take the name away and create it yourself.
 *
 * The two are offered as equals rather than as a primary and a fallback. Creating the branch here
 * needs a token with write access, and a workspace that connected a read-only one — which is the
 * safer thing to connect, since one token serves everybody — can still use the whole feature by
 * copying. Neither is the lesser path.
 *
 * The name is editable. It is generated from the work item's sequence and label, and the person
 * about to do the work knows things the label does not say.
 */
export function CreateBranchModal({
  opened,
  suggestion,
  projects,
  defaultProject,
  onClose,
  onCreated,
}: {
  opened: boolean
  /** The generated name, which the person may edit before anything happens. */
  suggestion: string
  /** Every project a branch may be created in. */
  projects: string[]
  /** The one to offer first — what this work item already uses, or the first configured. */
  defaultProject: string
  onClose: () => void
  /** Called once the branch exists in GitLab, with what GitLab answered. */
  onCreated: (branch: string, project: string, created: CodeState) => Promise<void> | void
}) {
  const bridge = useBridge()
  const { colorScheme } = useTheme()
  const [name, setName] = useState(suggestion)
  const [project, setProject] = useState(defaultProject)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The suggestion arrives once the label has been resolved, which can be after the modal opens.
  useEffect(() => {
    if (opened) {
      setName(suggestion)
      setProject(defaultProject)
      setError(null)
    }
  }, [opened, suggestion, defaultProject])

  const problem = branchNameProblem(name)
  const overLimit = name.length > MAX_BRANCH_NAME

  async function createInGitLab() {
    if (problem) return
    setBusy(true)
    setError(null)
    try {
      const created = await gitlab.createBranch(bridge, project, name)
      await onCreated(name, project, created)
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create the branch.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Create a branch"
      centered
      /*
       * No blur, and barely any dimming on a light page.
       *
       * Mantine's default overlay is the same weight in both schemes, which on a light page reads as
       * the lights going out — and the object details behind it are context worth keeping legible,
       * not a distraction to suppress. The dialog is already a card on a surface; that is enough to
       * say which one has focus. Dark mode keeps more of the dimming, because a faint overlay on a
       * dark ground separates nothing.
       */
      overlayProps={{ backgroundOpacity: colorScheme === 'dark' ? 0.55 : 0.15 }}
    >
      <Stack gap="md">
        <TextInput
          // The count rides on the label's line rather than below the field, where it was a second
          // line of chrome under a one-line input — and where it sat next to the error message,
          // which is the thing that should have the space under there to itself.
          label={
            <Group justify="space-between" gap="xs" wrap="nowrap">
              <span>Branch name</span>
              <Text component="span" size="xs" fw={400} c={overLimit ? 'red' : 'dimmed'}>
                {name.length}/{MAX_BRANCH_NAME}
              </Text>
            </Group>
          }
          labelProps={{ style: { display: 'block' } }}
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          error={problem ?? undefined}
          rightSection={<CopyField value={name} what="Branch name" />}
          rightSectionPointerEvents="auto"
        />

        {projects.length > 1 && (
          <Select
            label="Project"
            description="Where the branch is created. Defaults to what this work item already uses."
            data={projects}
            value={project}
            onChange={(value) => setProject(value ?? defaultProject)}
            allowDeselect={false}
            searchable
          />
        )}

        <div>
          <Text size="xs" c="dimmed" mb={6}>
            Or create it yourself
          </Text>
          {/*
            Not Mantine's <Code>: its tinted background carries the text colour with it, and against
            the dark palette the command was the least readable thing in a dialog whose whole purpose
            is to be read and copied. A plain bordered box takes the body colour, which is the one
            colour guaranteed to read on the surface behind it.
          */}
          <Box
            style={{
              border: '1px solid var(--mantine-color-default-border)',
              borderRadius: 'var(--mantine-radius-sm)',
              padding: '8px 10px',
              overflowX: 'auto',
            }}
          >
            <Group gap="sm" wrap="nowrap" justify="space-between">
              <Text
                ff="monospace"
                size="sm"
                c="var(--mantine-color-text)"
                style={{ whiteSpace: 'nowrap' }}
              >
                {`git checkout -b ${name || '<name>'}`}
              </Text>
              <CopyField value={name ? `git checkout -b ${name}` : ''} what="Command" />
            </Group>
          </Box>
        </div>

        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        {/* No Cancel: the dialog's own close is the way out, and two of them is one too many. */}
        <Group gap="xs" justify="flex-end">
          <Button onClick={createInGitLab} disabled={Boolean(problem) || busy}>
            {busy ? 'Creating…' : 'Create in GitLab'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
