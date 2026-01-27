import React, { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import StaffGuard from '../../auth/StaffGuard'
import {
  getMenus,
  addMenu,
  updateMenu,
  deleteMenu
} from '../services/contentCreatorService'

export default function Menus() {
  const [menus, setMenus] = useState([])
  const [loading, setLoading] = useState(true)
  const [formVisible, setFormVisible] = useState(false)
  const [editingMenu, setEditingMenu] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    image_url: '',
    published: false
  })

  // Fetch menus
  const fetchMenus = async () => {
    try {
      setLoading(true)
      const data = await getMenus()
      setMenus(data)
    } catch (error) {
      console.error('Error fetching menus:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMenus()
  }, [])

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  // Handle Add or Update
  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingMenu) {
        await updateMenu(editingMenu.id, formData)
      } else {
        await addMenu(formData)
      }
      fetchMenus()
      setFormVisible(false)
      setEditingMenu(null)
      setFormData({
        name: '',
        description: '',
        price: '',
        category: '',
        image_url: '',
        published: false
      })
    } catch (error) {
      console.error('Error saving menu:', error)
    }
  }

  // Handle Edit
  const handleEdit = (menu) => {
    setEditingMenu(menu)
    setFormData(menu)
    setFormVisible(true)
  }

  // Handle Delete
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this menu?')) return
    try {
      await deleteMenu(id)
      fetchMenus()
    } catch (error) {
      console.error('Error deleting menu:', error)
    }
  }

  return (
    <StaffGuard allowedRoles={['content_creator']}>
      <div className="flex h-screen bg-gray-900 text-white">
        <Sidebar />
        <div className="flex-1 flex flex-col p-6">
          <TopBar staffName="Content Creator" />
          <h1 className="text-2xl font-bold mb-4">Menus</h1>

          {/* Add / Edit Form */}
          {formVisible && (
            <form
              onSubmit={handleSubmit}
              className="mb-6 bg-gray-800 p-4 rounded space-y-3"
            >
              <input
                type="text"
                name="name"
                placeholder="Menu Name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full p-2 rounded text-black"
              />
              <textarea
                name="description"
                placeholder="Description"
                value={formData.description}
                onChange={handleChange}
                className="w-full p-2 rounded text-black"
              />
              <input
                type="number"
                name="price"
                placeholder="Price"
                value={formData.price}
                onChange={handleChange}
                required
                className="w-full p-2 rounded text-black"
              />
              <input
                type="text"
                name="category"
                placeholder="Category"
                value={formData.category}
                onChange={handleChange}
                className="w-full p-2 rounded text-black"
              />
              <input
  type="file"
  name="image_file"
  onChange={async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const url = await uploadImage(file, 'menus')
      setFormData(prev => ({ ...prev, image_url: url }))
    } catch (err) {
      console.error('Image upload error:', err)
      alert('Failed to upload image')
    }
  }}
  className="w-full p-2 rounded text-black"
/>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="published"
                  checked={formData.published}
                  onChange={handleChange}
                />
                <span>Published</span>
              </label>
              <div className="flex space-x-2">
                <button
                  type="submit"
                  className="bg-purple-600 px-4 py-2 rounded hover:bg-purple-700"
                >
                  {editingMenu ? 'Update Menu' : 'Add Menu'}
                </button>
                <button
                  type="button"
                  className="bg-gray-600 px-4 py-2 rounded hover:bg-gray-700"
                  onClick={() => {
                    setFormVisible(false)
                    setEditingMenu(null)
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <button
            className="mb-4 bg-purple-600 px-4 py-2 rounded hover:bg-purple-700"
            onClick={() => setFormVisible(true)}
          >
            {editingMenu ? 'Edit Menu' : 'Add Menu'}
          </button>

          {/* Menus Table */}
          {loading ? (
            <p>Loading menus...</p>
          ) : (
            <table className="w-full text-left border border-gray-700">
              <thead>
                <tr>
                  <th className="px-4 py-2 border-b">Name</th>
                  <th className="px-4 py-2 border-b">Price</th>
                  <th className="px-4 py-2 border-b">Category</th>
                  <th className="px-4 py-2 border-b">Published</th>
                  <th className="px-4 py-2 border-b">Actions</th>
                </tr>
              </thead>
              <tbody>
                {menus.map((menu) => (
                  <tr key={menu.id}>
                    <td className="px-4 py-2 border-b">{menu.name}</td>
                    <td className="px-4 py-2 border-b">{menu.price}</td>
                    <td className="px-4 py-2 border-b">{menu.category}</td>
                    <td className="px-4 py-2 border-b">
                      {menu.published ? 'Yes' : 'No'}
                    </td>
                    <td className="px-4 py-2 border-b space-x-2">
                      <button
                        className="bg-yellow-600 px-2 py-1 rounded"
                        onClick={() => handleEdit(menu)}
                      >
                        Edit
                      </button>
                      <button
                        className="bg-red-600 px-2 py-1 rounded"
                        onClick={() => handleDelete(menu.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </StaffGuard>
  )
}
