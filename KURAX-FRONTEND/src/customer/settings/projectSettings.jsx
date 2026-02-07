import React, { useState } from "react";

export default function ProjectSettings() {
  const [settings, setSettings] = useState({
    restaurantName: "Kurax Food Lounge & Bistro",
    location: "Kampala, Uganda",
    phone: "+256 700 000 000",
    email: "info@kurax.com",
    description: "Premium dining and event experience",

    defaultMenuStatus: "draft",
    defaultEventStatus: "draft",
    currency: "UGX",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "24",

    autoCompressImages: true,
    imageRatio: "landscape",

    notifyReservations: true,
    notifyBookings: true,

    confirmBeforePublish: true,
    autoUnpublishEvents: true
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  return (
    <div className="max-w-5xl mx-auto p-8 text-slate-100">
      <h1 className="text-3xl font-bold mb-8">Project Settings</h1>

      {/* Restaurant Info */}
      <Section title="Restaurant Information">
        <Input label="Restaurant Name" name="restaurantName" value={settings.restaurantName} onChange={handleChange} />
        <Input label="Location" name="location" value={settings.location} onChange={handleChange} />
        <Input label="Contact Phone" name="phone" value={settings.phone} onChange={handleChange} />
        <Input label="Contact Email" name="email" value={settings.email} onChange={handleChange} />
        <Textarea label="Description" name="description" value={settings.description} onChange={handleChange} />
      </Section>

      {/* Content Defaults */}
      <Section title="Content Defaults">
        <Select label="Default Menu Status" name="defaultMenuStatus" value={settings.defaultMenuStatus} onChange={handleChange}
          options={["draft", "published"]} />
        <Select label="Default Event Status" name="defaultEventStatus" value={settings.defaultEventStatus} onChange={handleChange}
          options={["draft", "published"]} />
        <Input label="Currency" value="UGX" disabled />
        <Select label="Date Format" name="dateFormat" value={settings.dateFormat} onChange={handleChange}
          options={["DD/MM/YYYY", "MM/DD/YYYY"]} />
        <Select label="Time Format" name="timeFormat" value={settings.timeFormat} onChange={handleChange}
          options={["12", "24"]} />
      </Section>

      {/* Media Settings */}
      <Section title="Media Settings">
        <Select
          label="Image Aspect Ratio"
          name="imageRatio"
          value={settings.imageRatio}
          onChange={handleChange}
          options={["square", "landscape", "portrait"]}
        />
        <Toggle
          label="Auto-compress uploaded images"
          name="autoCompressImages"
          checked={settings.autoCompressImages}
          onChange={handleChange}
        />
      </Section>

      {/* Notifications */}
      <Section title="Notifications">
        <Toggle
          label="Notify staff on new reservations"
          name="notifyReservations"
          checked={settings.notifyReservations}
          onChange={handleChange}
        />
        <Toggle
          label="Notify staff on event bookings"
          name="notifyBookings"
          checked={settings.notifyBookings}
          onChange={handleChange}
        />
      </Section>

      {/* Publishing Rules */}
      <Section title="Publishing Rules">
        <Toggle
          label="Require confirmation before publishing"
          name="confirmBeforePublish"
          checked={settings.confirmBeforePublish}
          onChange={handleChange}
        />
        <Toggle
          label="Auto-unpublish expired events"
          name="autoUnpublishEvents"
          checked={settings.autoUnpublishEvents}
          onChange={handleChange}
        />
      </Section>

      {/* Danger Zone */}
      <Section title="Danger Zone" danger>
        <button className="w-full py-3 rounded-lg border border-red-600 text-red-400 cursor-not-allowed opacity-60">
          Reset Project Data (Disabled)
        </button>
        <button className="w-full py-3 rounded-lg border border-red-700 text-red-500 cursor-not-allowed opacity-60 mt-3">
          Delete Project (Disabled)
        </button>
      </Section>

      {/* Save */}
      <div className="mt-8 flex justify-end">
        <button className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-lg">
          Save Settings
        </button>
      </div>
    </div>
  );
}

/* ================== UI HELPERS ================== */

function Section({ title, children, danger }) {
  return (
    <div className={`mb-8 p-6 rounded-2xl border ${danger ? "border-red-700 bg-red-900/10" : "border-slate-800 bg-slate-900/50"}`}>
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <div className="flex flex-col">
      <label className="text-sm text-slate-400 mb-1">{label}</label>
      <input {...props} className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-white" />
    </div>
  );
}

function Textarea({ label, ...props }) {
  return (
    <div className="flex flex-col md:col-span-2">
      <label className="text-sm text-slate-400 mb-1">{label}</label>
      <textarea {...props} rows={3} className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-white" />
    </div>
  );
}

function Select({ label, options, ...props }) {
  return (
    <div className="flex flex-col">
      <label className="text-sm text-slate-400 mb-1">{label}</label>
      <select {...props} className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-white">
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function Toggle({ label, ...props }) {
  return (
    <label className="flex items-center gap-3">
      <input type="checkbox" {...props} className="w-5 h-5 accent-yellow-500" />
      <span className="text-sm">{label}</span>
    </label>
  );
}
