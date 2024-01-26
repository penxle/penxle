import { mergeAttributes, Node } from '@tiptap/core';

export type TableHeaderOptions = {
  HTMLAttributes: Record<string, unknown>;
};
export const TableHeader = Node.create<TableHeaderOptions>({
  name: 'tableHeader',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  content: 'block+',

  addAttributes() {
    return {
      colspan: {
        default: 1,
      },
      rowspan: {
        default: 1,
      },
      colwidth: {
        default: null,
        parseHTML: (element) => {
          const colwidth = element.getAttribute('colwidth');
          const value = colwidth ? [Number.parseInt(colwidth, 10)] : null;

          return value;
        },
      },
    };
  },

  tableRole: 'header_cell',

  isolating: true,

  parseHTML() {
    return [{ tag: 'th' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['th', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },
});
