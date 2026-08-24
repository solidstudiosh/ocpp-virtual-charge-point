import { BoxRenderable, InputRenderable, TextRenderable } from "@opentui/core";
import type { RenderContext } from "@opentui/core";
import { color } from "../theme";
import type { View } from "../view";

export interface IdTagFieldProps {
  value: string;
  editing: boolean;
}

export interface IdTagFieldView extends View<IdTagFieldProps> {
  /** The text currently held by the input, for commit on Enter. */
  value(): string;
}

/**
 * Single-line idTag override readout/editor.
 *
 * While editing, a real `InputRenderable` owns the text — so cursor movement,
 * mid-string edits and paste all work. The Ink version accumulated keystrokes
 * into a string by hand and supported only append and backspace.
 */
export function createIdTagField(
  ctx: RenderContext,
  initial: IdTagFieldProps,
): IdTagFieldView {
  const root = new BoxRenderable(ctx, { id: "idtag", flexDirection: "row" });

  const label = new TextRenderable(ctx, {
    id: "idtag-label",
    content: "idTag ",
    fg: color.dim,
  });
  const readout = new TextRenderable(ctx, { id: "idtag-readout" });
  const hint = new TextRenderable(ctx, { id: "idtag-hint", fg: color.dim });
  const input = new InputRenderable(ctx, {
    id: "idtag-input",
    value: initial.value,
  });

  root.add(label);
  root.add(readout);
  root.add(input);
  root.add(hint);

  const update = (p: IdTagFieldProps) => {
    input.visible = p.editing;
    readout.visible = !p.editing;
    if (p.editing) {
      hint.content = " (Enter confirm · Esc cancel)";
      // Core only delivers keypresses to a focused Renderable — without this
      // the editor opens but swallows every keystroke. focus() is a no-op
      // when already focused, so calling it on every update is harmless.
      input.focus();
    } else {
      readout.content = p.value === "" ? "(none)" : p.value;
      readout.fg = p.value === "" ? color.dim : color.success;
      hint.content = " [t] edit";
      // Re-seed the editor so opening it starts from the committed value.
      input.value = p.value;
      input.blur();
    }
  };

  update(initial);

  return {
    root,
    update,
    value: () => input.value,
    destroy() {
      root.destroyRecursively();
    },
  };
}
