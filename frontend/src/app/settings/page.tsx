"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Camera, Pencil, Plus, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useToast } from "@/components/Toast";
import { Avatar, Button, Card, Field, inputClass, Modal, PageHeader, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { EMPLOYMENT_TYPE_LABEL, formatTenure } from "@/lib/format";
import { AVATAR_SIZE, BANNER_SIZE, resizeImage } from "@/lib/image";
import { useSession } from "@/lib/session";
import type { Education, EmploymentType, Experience, Profile } from "@/lib/types";

const toMonthInput = (iso: string | null) => (iso ? iso.slice(0, 7) : "");
const fromMonthInput = (value: string) => (value ? `${value}-01` : null);

function ExperienceForm({ experience, onClose, onSaved }: { experience?: Experience; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: experience?.title ?? "",
    company: experience?.company ?? "",
    employmentType: experience?.employmentType ?? ("FULL_TIME" as EmploymentType),
    location: experience?.location ?? "",
    startDate: toMonthInput(experience?.startDate ?? null),
    endDate: toMonthInput(experience?.endDate ?? null),
    isCurrent: experience ? !experience.endDate : true,
    description: experience?.description ?? "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    const body = {
      title: form.title,
      company: form.company,
      employmentType: form.employmentType,
      location: form.location || null,
      startDate: fromMonthInput(form.startDate),
      endDate: form.isCurrent ? null : fromMonthInput(form.endDate),
      description: form.description || null,
    };
    try {
      if (experience) await api.patch(`/users/me/experiences/${experience.id}`, body);
      else await api.post("/users/me/experiences", body);
      toast(experience ? "Experience updated" : "Experience added 💼");
      onSaved();
    } catch (caught) {
      toast(errorMessage(caught), "error");
      setIsSaving(false);
    }
  };

  return (
    <Modal title={experience ? "Edit experience" : "Add experience"} onClose={onClose} wide>
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title">
            <input className={inputClass} placeholder="e.g. Product Manager" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          </Field>
          <Field label="Company or organisation">
            <input className={inputClass} placeholder="e.g. Flutterwave" value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} required />
          </Field>
          <Field label="Employment type">
            <select className={inputClass} value={form.employmentType} onChange={(event) => setForm({ ...form, employmentType: event.target.value as EmploymentType })}>
              {(Object.keys(EMPLOYMENT_TYPE_LABEL) as EmploymentType[]).map((type) => (
                <option key={type} value={type}>
                  {EMPLOYMENT_TYPE_LABEL[type]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Location">
            <input className={inputClass} placeholder="e.g. Lagos" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
          </Field>
          <Field label="Start date">
            <input className={inputClass} type="month" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} required />
          </Field>
          <Field label="End date">
            <input className={inputClass} type="month" value={form.endDate} disabled={form.isCurrent} onChange={(event) => setForm({ ...form, endDate: event.target.value })} required={!form.isCurrent} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isCurrent} onChange={(event) => setForm({ ...form, isCurrent: event.target.checked })} className="accent-[var(--primary)]" />I currently work here
        </label>
        <Field label="Description" hint="What you do, what you're proud of">
          <textarea className={inputClass} rows={4} maxLength={1000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EducationForm({ education, onClose, onSaved }: { education?: Education; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    school: education?.school ?? "",
    degree: education?.degree ?? "",
    fieldOfStudy: education?.fieldOfStudy ?? "",
    startYear: String(education?.startYear ?? new Date().getFullYear() - 4),
    endYear: education?.endYear ? String(education.endYear) : "",
    description: education?.description ?? "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    const body = {
      school: form.school,
      degree: form.degree || null,
      fieldOfStudy: form.fieldOfStudy || null,
      startYear: Number(form.startYear),
      endYear: form.endYear ? Number(form.endYear) : null,
      description: form.description || null,
    };
    try {
      if (education) await api.patch(`/users/me/educations/${education.id}`, body);
      else await api.post("/users/me/educations", body);
      toast(education ? "Education updated" : "Education added 🎓");
      onSaved();
    } catch (caught) {
      toast(errorMessage(caught), "error");
      setIsSaving(false);
    }
  };

  return (
    <Modal title={education ? "Edit education" : "Add education"} onClose={onClose} wide>
      <form onSubmit={save} className="space-y-4">
        <Field label="School">
          <input className={inputClass} placeholder="e.g. University of Edinburgh" value={form.school} onChange={(event) => setForm({ ...form, school: event.target.value })} required />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Degree">
            <input className={inputClass} placeholder="e.g. MSc" value={form.degree} onChange={(event) => setForm({ ...form, degree: event.target.value })} />
          </Field>
          <Field label="Field of study">
            <input className={inputClass} placeholder="e.g. Data Science" value={form.fieldOfStudy} onChange={(event) => setForm({ ...form, fieldOfStudy: event.target.value })} />
          </Field>
          <Field label="Start year">
            <input className={inputClass} type="number" value={form.startYear} onChange={(event) => setForm({ ...form, startYear: event.target.value })} required />
          </Field>
          <Field label="End year (or expected)">
            <input className={inputClass} type="number" value={form.endYear} onChange={(event) => setForm({ ...form, endYear: event.target.value })} />
          </Field>
        </div>
        <Field label="Description">
          <textarea className={inputClass} rows={3} maxLength={600} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function SettingsContent() {
  const { user, refreshUser } = useSession();
  const toast = useToast();
  const isWelcome = useSearchParams().get("welcome") === "1";
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", headline: "", bio: "", location: "", linkedinUrl: "", industry: "" });
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editingExperience, setEditingExperience] = useState<Experience | "new" | null>(null);
  const [editingEducation, setEditingEducation] = useState<Education | "new" | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await api.get<Profile>(`/users/${user.id}`);
    setProfile(data);
    setForm({ firstName: data.firstName, lastName: data.lastName, headline: data.headline ?? "", bio: data.bio ?? "", location: data.location ?? "", linkedinUrl: data.linkedinUrl ?? "", industry: data.industry ?? "" });
    setSkills(data.skills);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const saveBasics = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await api.patch("/users/me", {
        firstName: form.firstName,
        lastName: form.lastName,
        headline: form.headline || null,
        bio: form.bio || null,
        location: form.location || null,
        linkedinUrl: form.linkedinUrl || null,
        skills,
        ...(user?.role === "ALUMNI" && { industry: form.industry || null }),
      });
      await refreshUser();
      toast("Profile saved ✅");
    } catch (caught) {
      toast(errorMessage(caught), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const uploadImage = (field: "avatarUrl" | "bannerUrl") => async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const size = field === "avatarUrl" ? AVATAR_SIZE : BANNER_SIZE;
    try {
      const dataUrl = await resizeImage(file, size.width, size.height);
      await api.patch("/users/me", { [field]: dataUrl });
      setProfile((current) => (current ? { ...current, [field]: dataUrl } : current));
      await refreshUser();
      toast("Image updated 📸");
    } catch (caught) {
      toast(errorMessage(caught), "error");
    }
  };

  const removeImage = async (field: "avatarUrl" | "bannerUrl") => {
    await api.patch("/users/me", { [field]: null });
    setProfile((current) => (current ? { ...current, [field]: null } : current));
    await refreshUser();
  };

  const addSkill = () => {
    const skill = skillInput.trim();
    if (skill && !skills.includes(skill) && skills.length < 30) setSkills([...skills, skill]);
    setSkillInput("");
  };

  if (!profile || !user) return <Spinner />;

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title={isWelcome ? `Welcome, ${user.firstName}! 👋` : "Edit your profile"}
        description={isWelcome ? "Add a photo, a backdrop and your experience so people know who you are. A complete profile earns 25 points." : undefined}
        action={
          <Link href={`/profile/${user.id}`} className="text-sm font-semibold text-primary hover:underline">
            View profile →
          </Link>
        }
      />

      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className="relative">
            {profile.bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.bannerUrl} alt="" className="aspect-[4/1] w-full object-cover" />
            ) : (
              <div className="banner-default aspect-[4/1] w-full" />
            )}
            <div className="absolute right-3 top-3 flex gap-2">
              <label aria-label="Change backdrop" className="tap-target flex cursor-pointer items-center gap-1.5 rounded-full bg-surface/90 px-3 py-1.5 text-xs font-semibold shadow hover:bg-surface">
                <Camera className="size-4" /> <span className="hidden sm:inline">{profile.bannerUrl ? "Change backdrop" : "Upload backdrop"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={uploadImage("bannerUrl")} />
              </label>
              {profile.bannerUrl && (
                <button onClick={() => removeImage("bannerUrl")} className="rounded-full bg-surface/90 p-1.5 shadow" aria-label="Remove backdrop">
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-x-4 gap-y-2 px-4 pb-5 sm:px-5">
            <div className="relative -mt-[clamp(2.5rem,10vw,3.5rem)]">
              <Avatar user={profile} size="clamp(5rem, 20vw, 7rem)" className="border-4 border-surface" />
              <label className="absolute bottom-1 right-1 flex size-8 cursor-pointer items-center justify-center rounded-full border-2 border-surface bg-primary text-on-primary" title="Change photo">
                <Camera className="size-4" />
                <input type="file" accept="image/*" className="hidden" onChange={uploadImage("avatarUrl")} />
              </label>
            </div>
            <p className="pb-2 text-xs text-muted">Photos are resized in your browser: 320×320 for your photo, 1500×375 for the backdrop.</p>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-lg font-bold text-primary">Intro</h2>
          <form onSubmit={saveBasics} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="First name">
                <input className={inputClass} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required />
              </Field>
              <Field label="Last name">
                <input className={inputClass} value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required />
              </Field>
            </div>
            <Field label="Headline" hint="One line under your name, e.g. “Backend engineer · Mentor · Fintech”">
              <input className={inputClass} maxLength={120} value={form.headline} onChange={(event) => setForm({ ...form, headline: event.target.value })} />
            </Field>
            <Field label="About" hint={`${form.bio.length}/600`}>
              <textarea className={inputClass} rows={5} maxLength={600} value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="City">
                <input className={inputClass} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
              </Field>
              {user.role === "ALUMNI" && (
                <Field label="Industry">
                  <input className={inputClass} value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })} />
                </Field>
              )}
              <Field label="LinkedIn URL">
                <input className={inputClass} type="url" placeholder="https://www.linkedin.com/in/…" value={form.linkedinUrl} onChange={(event) => setForm({ ...form, linkedinUrl: event.target.value })} />
              </Field>
            </div>
            <Field label="Skills" hint="Press Enter to add. Up to 30.">
              <div className="flex flex-wrap items-center gap-2 rounded-control border border-line p-2">
                {skills.map((skill) => (
                  <span key={skill} className="flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
                    {skill}
                    <button type="button" onClick={() => setSkills(skills.filter((item) => item !== skill))} aria-label={`Remove ${skill}`}>
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                <input
                  value={skillInput}
                  onChange={(event) => setSkillInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addSkill();
                    }
                  }}
                  onBlur={addSkill}
                  placeholder="Add a skill…"
                  className="min-w-32 flex-1 bg-transparent text-base outline-none sm:text-sm"
                />
              </div>
            </Field>
            <div className="flex justify-end">
              <Button type="submit" isLoading={isSaving}>
                Save intro
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-5" >
          <div id="experience" className="mb-4 flex items-center justify-between scroll-mt-20">
            <h2 className="text-lg font-bold text-primary">Experience</h2>
            <Button size="sm" variant="secondary" onClick={() => setEditingExperience("new")}>
              <Plus className="size-4" /> Add
            </Button>
          </div>
          {profile.experiences.length === 0 ? (
            <p className="text-sm text-muted">{user.role === "ALUMNI" ? "Add your current role and past jobs." : "Add internships, SIWES placements, part-time work or volunteering."}</p>
          ) : (
            <ul className="divide-y divide-line">
              {profile.experiences.map((experience) => (
                <li key={experience.id} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold">{experience.title}</p>
                    <p className="text-sm">
                      {experience.company} · {EMPLOYMENT_TYPE_LABEL[experience.employmentType]}
                    </p>
                    <p className="text-xs text-muted">{formatTenure(experience.startDate, experience.endDate)}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setEditingExperience(experience)} className="rounded-full p-2 text-muted hover:bg-surface-muted" aria-label="Edit">
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={async () => {
                        await api.delete(`/users/me/experiences/${experience.id}`);
                        toast("Experience removed");
                        load();
                      }}
                      className="rounded-full p-2 text-muted hover:bg-danger-soft hover:text-danger"
                      aria-label="Delete"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div id="education" className="mb-4 flex items-center justify-between scroll-mt-20">
            <h2 className="text-lg font-bold text-primary">Education</h2>
            <Button size="sm" variant="secondary" onClick={() => setEditingEducation("new")}>
              <Plus className="size-4" /> Add
            </Button>
          </div>
          <ul className="divide-y divide-line">
            {profile.educations.map((education) => (
              <li key={education.id} className="flex items-start justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold">{education.school}</p>
                  <p className="text-sm">{[education.degree, education.fieldOfStudy].filter(Boolean).join(", ")}</p>
                  <p className="text-xs text-muted">
                    {education.startYear} – {education.endYear ?? "Present"}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditingEducation(education)} className="rounded-full p-2 text-muted hover:bg-surface-muted" aria-label="Edit">
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await api.delete(`/users/me/educations/${education.id}`);
                        toast("Education removed");
                        load();
                      } catch (caught) {
                        toast(errorMessage(caught), "error");
                      }
                    }}
                    className="rounded-full p-2 text-muted hover:bg-danger-soft hover:text-danger"
                    aria-label="Delete"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {editingExperience && (
        <ExperienceForm
          experience={editingExperience === "new" ? undefined : editingExperience}
          onClose={() => setEditingExperience(null)}
          onSaved={() => {
            setEditingExperience(null);
            load();
            refreshUser();
          }}
        />
      )}
      {editingEducation && (
        <EducationForm
          education={editingEducation === "new" ? undefined : editingEducation}
          onClose={() => setEditingEducation(null)}
          onSaved={() => {
            setEditingEducation(null);
            load();
          }}
        />
      )}
    </>
  );
}

export default function SettingsPage() {
  return (
    <AppShell>
      <Suspense>
        <SettingsContent />
      </Suspense>
    </AppShell>
  );
}
