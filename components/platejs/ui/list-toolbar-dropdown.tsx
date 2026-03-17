'use client';

import { ListStyleType, someList, toggleList } from '@platejs/list';
import {
  useIndentTodoToolBarButton,
  useIndentTodoToolBarButtonState,
} from '@platejs/list/react';
import {
  useToggleToolbarButton,
  useToggleToolbarButtonState,
} from '@platejs/toggle/react';
import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';
import {
  List,
  ListCollapseIcon,
  ListIcon,
  ListOrdered,
  ListTodoIcon,
} from 'lucide-react';
import { useEditorRef, useEditorSelector } from 'platejs/react';
import * as React from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/platejs/ui/dropdown-menu';

import { ToolbarButton } from './toolbar';

export function ListToolbarDropdown(props: DropdownMenuProps) {
  const editor = useEditorRef();
  const [open, setOpen] = React.useState(false);

  const isBulletedList = useEditorSelector(
    (editor) =>
      someList(editor, [
        ListStyleType.Disc,
        ListStyleType.Circle,
        ListStyleType.Square,
      ]),
    []
  );

  const isNumberedList = useEditorSelector(
    (editor) =>
      someList(editor, [
        ListStyleType.Decimal,
        ListStyleType.LowerAlpha,
        ListStyleType.UpperAlpha,
        ListStyleType.LowerRoman,
        ListStyleType.UpperRoman,
      ]),
    []
  );

  const todoState = useIndentTodoToolBarButtonState({ nodeType: 'todo' });
  const { props: todoProps } = useIndentTodoToolBarButton(todoState);

  const toggleState = useToggleToolbarButtonState();
  const { props: toggleProps } = useToggleToolbarButton(toggleState);

  const hasActiveList = isBulletedList || isNumberedList;

  return (
    <DropdownMenu modal={false} onOpenChange={setOpen} open={open} {...props}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton pressed={open || hasActiveList} tooltip="Lists">
          <ListIcon />
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="ignore-click-outside/toolbar flex max-h-[500px] min-w-[180px] flex-col overflow-y-auto"
      >
        <DropdownMenuGroup>
          <DropdownMenuItem
            onSelect={() => {
              toggleList(editor, { listStyleType: ListStyleType.Disc });
              editor.tf.focus();
            }}
          >
            <List className="size-4" />
            Bulleted list
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={() => {
              toggleList(editor, { listStyleType: ListStyleType.Decimal });
              editor.tf.focus();
            }}
          >
            <ListOrdered className="size-4" />
            Numbered list
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={() => {
              (todoProps.onClick as any)?.();
              editor.tf.focus();
            }}
          >
            <ListTodoIcon className="size-4" />
            Todo list
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={() => {
              (toggleProps.onClick as any)?.();
              editor.tf.focus();
            }}
          >
            <ListCollapseIcon className="size-4" />
            Toggle
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
