"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { GraduationCap, Briefcase } from "lucide-react";
import { Logo } from "@/components/AppShell";
import { Button, Card, Field, inputClass } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { Department } from "@/lib/types";

const currentYear = new Date().getFullYear();

function RegisterForm() {
  const { register } = useSession();
  const router = useRouter();
  const initialRole = useSearchParams().get("role") === "ALUMNI" ? "ALUMNI" : "STUDENT";
  const [role, setRole] = useState<"STUDENT" | "ALUMNI">(initialRole);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    departmentId: "",
    graduationYear: String(currentYear + 2),
    studentLevel: "200",
    jobTitle: "",
    company: "",
    industry: "",
    location: "Lagos",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    api.get<Department[]>("/departments").then(({ data }) => setDepartments(data)).catch((caught) => setError(errorMessage(caught)));
  }, []);

  useEffect(() => {
    setForm((current) => ({ ...current, graduationYear: String(role === "STUDENT" ? currentYear + 2 : currentYear - 3) }));
  }, [role]);

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [key]: event.target.value });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const common = { role, email: form.email, password: form.password, firstName: form.firstName, lastName: form.lastName, departmentId: form.departmentId, graduationYear: Number(form.graduationYear) };
    try {
      await register(
        role === "STUDENT"
          ? { ...common, studentLevel: Number(form.studentLevel) }
          : { ...common, jobTitle: form.jobTitle, company: form.company, industry: form.industry || undefined, location: form.location || undefined },
      );
      router.replace("/settings?welcome=1");
    } catch (caught) {
      setError(errorMessage(caught));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <Card className="p-6">
          <h1 className="text-xl font-bold text-primary">Join PAU Network</h1>
          <p className="mb-5 text-sm text-muted">Students find mentors. Alumni give back on their own schedule.</p>

          <div className="mb-5 grid grid-cols-2 gap-2">
            {[
              { value: "STUDENT" as const, label: "Student", icon: GraduationCap },
              { value: "ALUMNI" as const, label: "Alumnus", icon: Briefcase },
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setRole(value)}
                className={`flex items-center justify-center gap-2 rounded-control border px-3 py-3 text-sm font-semibold transition ${role === value ? "border-primary bg-primary-soft text-primary" : "border-line text-muted hover:text-ink"}`}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>

          <form className="space-y-4" onSubmit={submit}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name">
                <input className={inputClass} value={form.firstName} onChange={update("firstName")} required />
              </Field>
              <Field label="Last name">
                <input className={inputClass} value={form.lastName} onChange={update("lastName")} required />
              </Field>
            </div>
            <Field label="Email">
              <input className={inputClass} type="email" value={form.email} onChange={update("email")} required />
            </Field>
            <Field label="Password" hint="At least 8 characters">
              <input className={inputClass} type="password" minLength={8} value={form.password} onChange={update("password")} required />
            </Field>
            <Field label="Department">
              <select className={inputClass} value={form.departmentId} onChange={update("departmentId")} required>
                <option value="">Select your course</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </Field>

            {role === "STUDENT" ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Level">
                  <select className={inputClass} value={form.studentLevel} onChange={update("studentLevel")}>
                    {[100, 200, 300, 400, 500].map((level) => (
                      <option key={level} value={level}>
                        {level}L
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Expected graduation">
                  <input className={inputClass} type="number" min={currentYear} max={currentYear + 6} value={form.graduationYear} onChange={update("graduationYear")} required />
                </Field>
              </div>
            ) : (
              <>
                <Field label="Graduation year">
                  <input className={inputClass} type="number" min={1990} max={currentYear} value={form.graduationYear} onChange={update("graduationYear")} required />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Current job title">
                    <input className={inputClass} value={form.jobTitle} onChange={update("jobTitle")} required />
                  </Field>
                  <Field label="Company">
                    <input className={inputClass} value={form.company} onChange={update("company")} required />
                  </Field>
                  <Field label="Industry">
                    <input className={inputClass} placeholder="e.g. Fintech" value={form.industry} onChange={update("industry")} />
                  </Field>
                  <Field label="City">
                    <input className={inputClass} value={form.location} onChange={update("location")} />
                  </Field>
                </div>
              </>
            )}

            {error && <p className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full" isLoading={isSubmitting}>
              Create account
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted">
            Already a member?{" "}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Log in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
