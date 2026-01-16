import { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Mail, User, Users, X, Tag } from 'lucide-react';
import { contactsApi, Contact, ContactCreate, ContactUpdate } from '../lib/api';

export function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all'); // Default to 'all'
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // Form states
  const [formData, setFormData] = useState<ContactCreate>({
    name: '',
    emails: [],
    groups: [],
  });
  const [emailInput, setEmailInput] = useState('');
  const [groupInput, setGroupInput] = useState('');

  // Load contacts and groups
  useEffect(() => {
    loadData();
  }, []);

  // Filter contacts based on search and group selection
  useEffect(() => {
    let filtered = contacts;

    // Filter by group (if not 'all')
    if (selectedGroup !== 'all') {
      filtered = filtered.filter(c => c.groups.includes(selectedGroup));
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.emails.some(e => e.toLowerCase().includes(query)) ||
        c.groups.some(g => g.toLowerCase().includes(query))
      );
    }

    setFilteredContacts(filtered);
  }, [contacts, searchQuery, selectedGroup]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [contactsResponse, groupsResponse] = await Promise.all([
        contactsApi.getContacts(),
        contactsApi.getGroups(),
      ]);

      setContacts(contactsResponse.contacts);
      setGroups(groupsResponse.groups);
      setFilteredContacts(contactsResponse.contacts);
    } catch (err: any) {
      setError(err.message || 'Failed to load contacts');
      console.error('Error loading contacts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddContact = async () => {
    try {
      await contactsApi.createContact(formData);
      setShowAddModal(false);
      resetForm();
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create contact');
    }
  };

  const handleUpdateContact = async () => {
    if (!selectedContact) return;

    try {
      await contactsApi.updateContact(selectedContact.id, formData);
      setShowEditModal(false);
      setSelectedContact(null);
      resetForm();
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update contact');
    }
  };

  const handleDeleteContact = async () => {
    if (!selectedContact) return;

    try {
      await contactsApi.deleteContact(selectedContact.id);
      setShowDeleteModal(false);
      setSelectedContact(null);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete contact');
    }
  };

  const openEditModal = (contact: Contact) => {
    setSelectedContact(contact);
    setFormData({
      name: contact.name,
      emails: [...contact.emails],
      groups: [...contact.groups],
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (contact: Contact) => {
    setSelectedContact(contact);
    setShowDeleteModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      emails: [],
      groups: [],
    });
    setEmailInput('');
    setGroupInput('');
  };

  const addEmail = () => {
    if (emailInput && !formData.emails?.includes(emailInput)) {
      setFormData({
        ...formData,
        emails: [...(formData.emails || []), emailInput],
      });
      setEmailInput('');
    }
  };

  const removeEmail = (email: string) => {
    setFormData({
      ...formData,
      emails: formData.emails?.filter(e => e !== email) || [],
    });
  };

  const addGroup = () => {
    if (groupInput && !formData.groups?.includes(groupInput)) {
      setFormData({
        ...formData,
        groups: [...(formData.groups || []), groupInput],
      });
      setGroupInput('');
    }
  };

  const removeGroup = (group: string) => {
    setFormData({
      ...formData,
      groups: formData.groups?.filter(g => g !== group) || [],
    });
  };

  // Group contacts by first letter for display
  const groupedContacts = filteredContacts.reduce((acc, contact) => {
    const firstLetter = contact.name.charAt(0).toUpperCase();
    if (!acc[firstLetter]) {
      acc[firstLetter] = [];
    }
    acc[firstLetter].push(contact);
    return acc;
  }, {} as Record<string, Contact[]>);

  const sortedLetters = Object.keys(groupedContacts).sort();

  // Calculate contact count per group
  const getGroupContactCount = (group: string) => {
    if (group === 'all') return contacts.length;
    return contacts.filter(c => c.groups.includes(group)).length;
  };

  return (
    <div className="h-full flex bg-gray-50">
      {/* Left Sidebar - Groups */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Groups
          </h2>
        </div>

        {/* Groups List */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-1">
            {/* All Groups */}
            <button
              onClick={() => setSelectedGroup('all')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                selectedGroup === 'all'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="font-medium">All Contacts</span>
              <span className={`text-sm ${
                selectedGroup === 'all' ? 'text-blue-600' : 'text-gray-400'
              }`}>
                {contacts.length}
              </span>
            </button>

            {/* Individual Groups */}
            {groups.map(group => (
              <button
                key={group}
                onClick={() => setSelectedGroup(group)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                  selectedGroup === group
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="font-medium">{group}</span>
                <span className={`text-sm ${
                  selectedGroup === group ? 'text-blue-600' : 'text-gray-400'
                }`}>
                  {getGroupContactCount(group)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Content - Contacts */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-6 h-6" />
              {selectedGroup === 'all' ? 'All Contacts' : selectedGroup}
            </h1>
            <button
              onClick={() => {
                resetForm();
                setShowAddModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Contact
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or group..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">Loading contacts...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-red-500">{error}</div>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <User className="w-16 h-16 mb-4 text-gray-300" />
            <p className="text-lg">No contacts found</p>
            <p className="text-sm">Try adjusting your search or add a new contact</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedLetters.map(letter => (
              <div key={letter}>
                <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full">
                    {letter}
                  </span>
                  {groupedContacts[letter].length} contact{groupedContacts[letter].length !== 1 ? 's' : ''}
                </h2>
                <div className="space-y-2">
                  {groupedContacts[letter].map(contact => (
                    <div
                      key={contact.id}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{contact.name}</h3>
                              <div className="text-sm text-gray-500">
                                {contact.emails.map(email => (
                                  <div key={email} className="flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    {email}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Groups */}
                          {contact.groups.length > 0 && (
                            <div className="flex flex-wrap gap-2 ml-13">
                              {contact.groups.map(group => (
                                <span
                                  key={group}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-xs"
                                >
                                  <Tag className="w-3 h-3" />
                                  {group}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditModal(contact)}
                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openDeleteModal(contact)}
                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>

      {/* Add Contact Modal */}
      {showAddModal && (
        <ContactModal
          title="Add New Contact"
          formData={formData}
          emailInput={emailInput}
          groupInput={groupInput}
          setFormData={setFormData}
          setEmailInput={setEmailInput}
          setGroupInput={setGroupInput}
          addEmail={addEmail}
          removeEmail={removeEmail}
          addGroup={addGroup}
          removeGroup={removeGroup}
          onSave={handleAddContact}
          onCancel={() => {
            setShowAddModal(false);
            resetForm();
          }}
          existingGroups={groups}
        />
      )}

      {/* Edit Contact Modal */}
      {showEditModal && (
        <ContactModal
          title="Edit Contact"
          formData={formData}
          emailInput={emailInput}
          groupInput={groupInput}
          setFormData={setFormData}
          setEmailInput={setEmailInput}
          setGroupInput={setGroupInput}
          addEmail={addEmail}
          removeEmail={removeEmail}
          addGroup={addGroup}
          removeGroup={removeGroup}
          onSave={handleUpdateContact}
          onCancel={() => {
            setShowEditModal(false);
            setSelectedContact(null);
            resetForm();
          }}
          existingGroups={groups}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedContact && (
        <DeleteConfirmModal
          contactName={selectedContact.name}
          onConfirm={handleDeleteContact}
          onCancel={() => {
            setShowDeleteModal(false);
            setSelectedContact(null);
          }}
        />
      )}
    </div>
  );
}

// Contact Modal Component
interface ContactModalProps {
  title: string;
  formData: ContactCreate;
  emailInput: string;
  groupInput: string;
  setFormData: (data: ContactCreate) => void;
  setEmailInput: (value: string) => void;
  setGroupInput: (value: string) => void;
  addEmail: () => void;
  removeEmail: (email: string) => void;
  addGroup: () => void;
  removeGroup: (group: string) => void;
  onSave: () => void;
  onCancel: () => void;
  existingGroups: string[];
}

function ContactModal({
  title,
  formData,
  emailInput,
  groupInput,
  setFormData,
  setEmailInput,
  setGroupInput,
  addEmail,
  removeEmail,
  addGroup,
  removeGroup,
  onSave,
  onCancel,
  existingGroups,
}: ContactModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">{title}</h2>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter contact name"
            />
          </div>

          {/* Emails */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Addresses
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Add email address"
              />
              <button
                onClick={addEmail}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {formData.emails && formData.emails.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.emails.map(email => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-md text-sm"
                  >
                    <Mail className="w-3 h-3" />
                    {email}
                    <button
                      onClick={() => removeEmail(email)}
                      className="ml-1 text-gray-500 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Groups */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Groups
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                list="existing-groups"
                value={groupInput}
                onChange={(e) => setGroupInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addGroup())}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Add or select group"
              />
              <datalist id="existing-groups">
                {existingGroups.map(group => (
                  <option key={group} value={group} />
                ))}
              </datalist>
              <button
                onClick={addGroup}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {formData.groups && formData.groups.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.groups.map(group => (
                  <span
                    key={group}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-sm"
                  >
                    <Tag className="w-3 h-3" />
                    {group}
                    <button
                      onClick={() => removeGroup(group)}
                      className="ml-1 text-purple-500 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!formData.name.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// Delete Confirmation Modal
interface DeleteConfirmModalProps {
  contactName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmModal({ contactName, onConfirm, onCancel }: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="px-6 py-4">
          <h2 className="text-xl font-semibold mb-2">Delete Contact</h2>
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{contactName}</strong>? This action cannot be undone.
          </p>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
