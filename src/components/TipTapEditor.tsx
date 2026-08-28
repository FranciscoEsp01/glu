import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  CheckSquare, 
  Heading2, 
  Code,
  Sparkles
} from 'lucide-react';

interface TipTapEditorProps {
  content: string;
  onChange: (html: string) => void;
  editable?: boolean;
}

export const TipTapEditor: React.FC<TipTapEditorProps> = ({
  content,
  onChange,
  editable = true,
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="w-full rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white/60 dark:bg-black/20 backdrop-blur-sm overflow-hidden transition-all">
      {/* Editor Toolbar */}
      {editable && (
        <div className="flex items-center gap-1 px-3 py-2 border-b border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02] flex-wrap">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-xs text-gray-600 dark:text-gray-300 ${
              editor.isActive('bold') ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold' : ''
            }`}
            title="Negrita (Cmd+B)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-xs text-gray-600 dark:text-gray-300 ${
              editor.isActive('italic') ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold' : ''
            }`}
            title="Cursiva (Cmd+I)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-xs text-gray-600 dark:text-gray-300 ${
              editor.isActive('heading', { level: 2 }) ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold' : ''
            }`}
            title="Título H2"
          >
            <Heading2 className="w-3.5 h-3.5" />
          </button>
          <div className="w-[1px] h-4 bg-gray-300 dark:bg-gray-700 mx-1" />
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-xs text-gray-600 dark:text-gray-300 ${
              editor.isActive('bulletList') ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold' : ''
            }`}
            title="Lista de viñetas"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-xs text-gray-600 dark:text-gray-300 ${
              editor.isActive('orderedList') ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold' : ''
            }`}
            title="Lista numerada"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-xs text-gray-600 dark:text-gray-300 ${
              editor.isActive('taskList') ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold' : ''
            }`}
            title="Lista de tareas con checkboxes"
          >
            <CheckSquare className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-xs text-gray-600 dark:text-gray-300 ${
              editor.isActive('codeBlock') ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold' : ''
            }`}
            title="Bloque de código"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
          <div className="ml-auto flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
            <Sparkles className="w-3 h-3 text-indigo-500" />
            <span>Editor Inteligente TipTap</span>
          </div>
        </div>
      )}

      {/* Editor Content Area */}
      <div className="p-4 text-sm text-gray-800 dark:text-gray-200 focus:outline-none">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};
