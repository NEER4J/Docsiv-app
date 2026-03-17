'use client';

import { triggerFloatingLink } from '@platejs/link/react';
import { PlaceholderPlugin } from '@platejs/media/react';
import { TablePlugin } from '@platejs/table/react';
import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';
import {
  AudioLinesIcon,
  FileUpIcon,
  FilmIcon,
  ImageIcon,
  LinkIcon,
  PlusIcon,
  SmileIcon,
  TableIcon,
} from 'lucide-react';
import { KEYS } from 'platejs';
import { useEditorPlugin, useEditorRef } from 'platejs/react';
import * as React from 'react';
import { useFilePicker } from 'use-file-picker';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/platejs/ui/dropdown-menu';

import { ToolbarButton } from './toolbar';

export function InsertContentToolbarDropdown(props: DropdownMenuProps) {
  const editor = useEditorRef();
  const { tf: tableTf } = useEditorPlugin(TablePlugin);
  const [open, setOpen] = React.useState(false);

  const { openFilePicker: openImagePicker } = useFilePicker({
    accept: ['image/*'],
    multiple: true,
    onFilesSelected: ({ plainFiles }) => {
      editor.getTransforms(PlaceholderPlugin).insert.media(plainFiles);
    },
  });

  const { openFilePicker: openVideoPicker } = useFilePicker({
    accept: ['video/*'],
    multiple: true,
    onFilesSelected: ({ plainFiles }) => {
      editor.getTransforms(PlaceholderPlugin).insert.media(plainFiles);
    },
  });

  const { openFilePicker: openAudioPicker } = useFilePicker({
    accept: ['audio/*'],
    multiple: true,
    onFilesSelected: ({ plainFiles }) => {
      editor.getTransforms(PlaceholderPlugin).insert.media(plainFiles);
    },
  });

  const { openFilePicker: openFilePicker } = useFilePicker({
    accept: ['*'],
    multiple: true,
    onFilesSelected: ({ plainFiles }) => {
      editor.getTransforms(PlaceholderPlugin).insert.media(plainFiles);
    },
  });

  return (
    <DropdownMenu modal={false} onOpenChange={setOpen} open={open} {...props}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton pressed={open} tooltip="Insert content">
          <PlusIcon />
          Insert
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="ignore-click-outside/toolbar flex max-h-[500px] min-w-[180px] flex-col overflow-y-auto"
      >
        <DropdownMenuGroup>
          <DropdownMenuItem
            onSelect={() => {
              triggerFloatingLink(editor, { focused: true });
            }}
          >
            <LinkIcon className="size-4" />
            Link
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={() => {
              tableTf.insert.table({ colCount: 3, rowCount: 3 }, { select: true });
              editor.tf.focus();
            }}
          >
            <TableIcon className="size-4" />
            Table
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={() => {
              // Trigger emoji picker by simulating the toolbar button
              // We'll dispatch a custom event that the emoji button listens to
              editor.tf.insertNodes({
                children: [{ text: '' }],
                type: KEYS.emoji,
                value: '😀',
              });
              editor.tf.focus();
            }}
          >
            <SmileIcon className="size-4" />
            Emoji
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Media</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => openImagePicker()}>
            <ImageIcon className="size-4" />
            Image
          </DropdownMenuItem>

          <DropdownMenuItem onSelect={() => openVideoPicker()}>
            <FilmIcon className="size-4" />
            Video
          </DropdownMenuItem>

          <DropdownMenuItem onSelect={() => openAudioPicker()}>
            <AudioLinesIcon className="size-4" />
            Audio
          </DropdownMenuItem>

          <DropdownMenuItem onSelect={() => openFilePicker()}>
            <FileUpIcon className="size-4" />
            File
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
