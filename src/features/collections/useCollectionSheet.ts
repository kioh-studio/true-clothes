import { useState } from 'react';
import { Collection } from '../../data';

interface SheetState {
  name: string;
  description: string;
  visible: boolean;
  mode: 'create' | 'edit';
  editingId: string | null;
}

export function useCollectionSheet() {
  const [state, setState] = useState<SheetState>({
    name: '',
    description: '',
    visible: false,
    mode: 'create',
    editingId: null,
  });

  const openCreate = () =>
    setState({ name: '', description: '', visible: true, mode: 'create', editingId: null });

  const openEdit = (collection: Collection) =>
    setState({ name: collection.name, description: collection.description, visible: true, mode: 'edit', editingId: collection.id });

  const close = () => setState(s => ({ ...s, visible: false }));
  const setName = (name: string) => setState(s => ({ ...s, name }));
  const setDescription = (description: string) => setState(s => ({ ...s, description }));

  return { ...state, openCreate, openEdit, close, setName, setDescription };
}
