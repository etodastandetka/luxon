'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Template {
  id: number
  text: string
  order: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function ChatTemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingText, setEditingText] = useState('')
  const [editingOrder, setEditingOrder] = useState(0)
  const [newTemplateText, setNewTemplateText] = useState('')
  const [newTemplateOrder, setNewTemplateOrder] = useState(0)
  const [showAddForm, setShowAddForm] = useState(false)

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/chat/templates')
      const data = await response.json()
      if (data.success) {
        setTemplates(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  const handleAdd = async () => {
    if (!newTemplateText.trim()) return

    try {
      const response = await fetch('/api/chat/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: newTemplateText,
          order: newTemplateOrder,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setNewTemplateText('')
        setNewTemplateOrder(0)
        setShowAddForm(false)
        await fetchTemplates()
      } else {
        alert(data.error || 'Ошибка при создании шаблона')
      }
    } catch (error) {
      console.error('Failed to create template:', error)
      alert('Ошибка при создании шаблона')
    }
  }

  const handleEdit = (template: Template) => {
    setEditingId(template.id)
    setEditingText(template.text)
    setEditingOrder(template.order)
  }

  const handleSave = async (id: number) => {
    if (!editingText.trim()) return

    try {
      const response = await fetch(`/api/chat/templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: editingText,
          order: editingOrder,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setEditingId(null)
        setEditingText('')
        setEditingOrder(0)
        await fetchTemplates()
      } else {
        alert(data.error || 'Ошибка при обновлении шаблона')
      }
    } catch (error) {
      console.error('Failed to update template:', error)
      alert('Ошибка при обновлении шаблона')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить этот шаблон?')) return

    try {
      const response = await fetch(`/api/chat/templates/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        await fetchTemplates()
      } else {
        alert(data.error || 'Ошибка при удалении шаблона')
      }
    } catch (error) {
      console.error('Failed to delete template:', error)
      alert('Ошибка при удалении шаблона')
    }
  }

  const handleToggleActive = async (id: number, currentActive: boolean) => {
    try {
      const response = await fetch(`/api/chat/templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      })

      const data = await response.json()
      if (data.success) {
        await fetchTemplates()
      } else {
        alert(data.error || 'Ошибка при изменении статуса')
      }
    } catch (error) {
      console.error('Failed to toggle template:', error)
      alert('Ошибка при изменении статуса')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    )
  }

  return (
    <div className="py-4">
      <div className="flex items-center justify-between mb-4 px-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-white">Шаблоны сообщений</h1>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
        >
          {showAddForm ? 'Отмена' : '+ Добавить'}
        </button>
      </div>

      {showAddForm && (
        <div className="mb-4 px-4">
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <textarea
              value={newTemplateText}
              onChange={(e) => setNewTemplateText(e.target.value)}
              placeholder="Текст шаблона..."
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              rows={3}
            />
            <div className="flex items-center gap-4 mb-2">
              <label className="text-white text-sm">Порядок:</label>
              <input
                type="number"
                value={newTemplateOrder}
                onChange={(e) => setNewTemplateOrder(parseInt(e.target.value) || 0)}
                className="w-20 bg-gray-700 text-white rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
            >
              Сохранить
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3 px-4">
        {templates.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <p>Нет шаблонов</p>
          </div>
        ) : (
          templates.map((template) => (
            <div
              key={template.id}
              className={`bg-gray-800 rounded-xl p-4 border ${
                template.isActive ? 'border-gray-700' : 'border-gray-600 opacity-60'
              }`}
            >
              {editingId === template.id ? (
                <div>
                  <textarea
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    rows={3}
                  />
                  <div className="flex items-center gap-4 mb-2">
                    <label className="text-white text-sm">Порядок:</label>
                    <input
                      type="number"
                      value={editingOrder}
                      onChange={(e) => setEditingOrder(parseInt(e.target.value) || 0)}
                      className="w-20 bg-gray-700 text-white rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSave(template.id)}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                    >
                      Сохранить
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null)
                        setEditingText('')
                        setEditingOrder(0)
                      }}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-white flex-1">{template.text}</p>
                    <div className="flex items-center gap-2 ml-4">
                      <span className="text-xs text-gray-400">#{template.order}</span>
                      <button
                        onClick={() => handleToggleActive(template.id, template.isActive)}
                        className={`px-2 py-1 rounded text-xs ${
                          template.isActive
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-600 text-gray-300'
                        }`}
                      >
                        {template.isActive ? 'Активен' : 'Неактивен'}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleEdit(template)}
                      className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm transition-colors"
                    >
                      Редактировать
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm transition-colors"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

