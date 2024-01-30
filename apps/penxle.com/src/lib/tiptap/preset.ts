import {
  DropCursor,
  FontFamily,
  GapCursor,
  History,
  LetterSpacing,
  LineHeight,
  Placeholder,
  TextAlign,
} from '$lib/tiptap/extensions';
import { Bold, Italic, Link, Strike, TextColor, Underline } from '$lib/tiptap/marks';
import { AccessBarrier, Embed, File, Image } from '$lib/tiptap/node-views';
import {
  BulletList,
  Document,
  HardBreak,
  Heading,
  HorizontalRule,
  ListItem,
  OrderedList,
  Paragraph,
  Text,
} from '$lib/tiptap/nodes';
import { Blockquote } from './nodes/blockquote';

export const extensions = [
  // special nodes
  Document,
  Text,

  // nodes
  HardBreak,
  Heading,
  Paragraph,
  HorizontalRule,
  Blockquote,
  ListItem,
  BulletList,
  OrderedList,

  // marks
  Bold,
  Italic,
  Strike,
  TextColor,
  Underline,
  Link,

  // extensions
  DropCursor,
  GapCursor,
  History,
  Placeholder,
  TextAlign,
  FontFamily,
  LineHeight,
  LetterSpacing,

  // node views
  AccessBarrier,
  Embed,
  File,
  Image,
];
