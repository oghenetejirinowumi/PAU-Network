"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ArrowLeft, Briefcase, GraduationCap, MessageCircle, Users } from "lucide-react";
import { Button, Card, Field, inputClass } from "@/components/ui";
import { API_URL, api, errorMessage } from "@/lib/api";
import { INDUSTRIES } from "@/lib/constants";
import { useSession } from "@/lib/session";
import type { Department } from "@/lib/types";

const currentYear = new Date().getFullYear();

function RegisterForm() {
  const { register, registerLinkedIn } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkedInRegistration = searchParams.get("linkedin") === "1";
  const initialRole = searchParams.get("role") === "ALUMNI" ? "ALUMNI" : "STUDENT";
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
    linkedinUrl: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    api.get<Department[]>("/departments").then(({ data }) => setDepartments(data)).catch((caught) => setError(errorMessage(caught)));
  }, []);

  useEffect(() => {
    if (!linkedInRegistration) return;
    api
      .get<{ email: string; firstName: string; lastName: string; avatarUrl: string | null }>("/auth/linkedin/pending")
      .then(({ data }) => setForm((current) => ({ ...current, email: data.email, firstName: data.firstName, lastName: data.lastName })))
      .catch((caught) => setError(errorMessage(caught)));
  }, [linkedInRegistration]);

  useEffect(() => {
    setForm((current) => ({ ...current, graduationYear: String(role === "STUDENT" ? currentYear + 2 : currentYear - 3) }));
  }, [role]);

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [key]: event.target.value });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const common = {
      role,
      departmentId: form.departmentId,
      graduationYear: Number(form.graduationYear),
    };
    const linkedInProfile = linkedInRegistration ? { linkedinUrl: form.linkedinUrl || undefined } : {};
    const studentInput = { ...common, ...linkedInProfile, studentLevel: Number(form.studentLevel) };
    const alumniInput = {
      ...common,
      ...linkedInProfile,
      jobTitle: form.jobTitle,
      company: form.company,
      industry: form.industry || undefined,
      location: form.location || undefined,
    };
    try {
      if (linkedInRegistration) {
        await registerLinkedIn(role === "STUDENT" ? studentInput : alumniInput);
      } else {
        await register(
          role === "STUDENT"
            ? { ...common, email: form.email, password: form.password, firstName: form.firstName, lastName: form.lastName, studentLevel: Number(form.studentLevel) }
            : { ...common, email: form.email, password: form.password, firstName: form.firstName, lastName: form.lastName, jobTitle: form.jobTitle, company: form.company, industry: form.industry || undefined, location: form.location || undefined },
        );
      }
      router.replace(role === "ALUMNI" ? "/onboarding/alumni" : "/settings?welcome=1");
    } catch (caught) {
      setError(errorMessage(caught));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-primary px-4 py-10">
      <div className="pointer-events-none absolute -left-12 top-12 text-white opacity-10" aria-hidden>
        <GraduationCap className="size-48 sm:size-64" strokeWidth={1} />
      </div>
      <div className="pointer-events-none absolute -right-10 top-1/4 text-white opacity-10" aria-hidden>
        <Users className="size-56 sm:size-80" strokeWidth={1} />
      </div>
      <div className="pointer-events-none absolute bottom-0 left-1/4 text-white opacity-10" aria-hidden>
        <MessageCircle className="size-48 sm:size-64" strokeWidth={1} />
      </div>
      <button
        type="button"
        onClick={() => router.back()}
        className="tap-target absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-control px-2 text-sm font-semibold text-white hover:bg-white/10 sm:left-5 sm:top-5"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back
      </button>
      <div className="relative z-10 w-full max-w-lg">
        <div className="mb-6 flex justify-center">
          <Image src="/PAU_NETWORK_LOGO_WHITE.png" alt="PAU Network" width={190} height={48} priority className="h-auto w-44 sm:w-48" />
        </div>
        <Card className="p-6 shadow-[0_0_45px_rgba(255,255,255,0.22)]">
          <h1 className="text-xl font-bold text-primary">Join PAU Network</h1>
          <p className="mb-5 text-sm text-muted">
            {linkedInRegistration ? "LinkedIn confirmed your identity. Complete your PAU details to finish joining." : "Students find mentors. Alumni give back on their own schedule."}
          </p>
          {!linkedInRegistration && (
            <>
              <a
                href={`${API_URL}/auth/linkedin`}
                className="mb-4 flex h-10 items-center justify-center rounded-control border border-line bg-surface text-sm font-semibold text-ink transition hover:bg-surface-muted"
              >
                Sign up with LinkedIn
              </a>
              <p className="mb-4 text-center text-xs text-muted">or create an account with email</p>
            </>
          )}

          <div className="mb-5 grid grid-cols-2 gap-2">
            {[
              { value: "STUDENT" as const, label: "Student", icon: GraduationCap },
              { value: "ALUMNI" as const, label: "Alumnas", icon: Briefcase },
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
                <input className={inputClass} value={form.firstName} onChange={update("firstName")} required readOnly={linkedInRegistration} />
              </Field>
              <Field label="Last name">
                <input className={inputClass} value={form.lastName} onChange={update("lastName")} required readOnly={linkedInRegistration} />
              </Field>
            </div>
            <Field label="Email">
              <input className={inputClass} type="email" value={form.email} onChange={update("email")} required readOnly={linkedInRegistration} />
            </Field>
            {linkedInRegistration && (
              <Field label="LinkedIn profile URL (optional)" hint="LinkedIn sign-in doesn’t share your public profile link. Paste it here, or add it later in Settings.">
                <input
                  className={inputClass}
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="https://www.linkedin.com/in/your-profile"
                  value={form.linkedinUrl}
                  onChange={update("linkedinUrl")}
                />
              </Field>
            )}
            {!linkedInRegistration && (
              <Field label="Password" hint="At least 8 characters">
                <input className={inputClass} type="password" minLength={8} value={form.password} onChange={update("password")} required />
              </Field>
            )}
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
                    <input className={inputClass} list="industry-options" placeholder="e.g. Finance" value={form.industry} onChange={update("industry")} />
                  </Field>
                  <Field label="City">
                    <input className={inputClass} value={form.location} onChange={update("location")} />
                  </Field>
                </div>
              </>
            )}

            <datalist id="industry-options">
              {INDUSTRIES.map((industry) => (
                <option key={industry} value={industry} />
              ))}
            </datalist>

            {error && <p className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full" isLoading={isSubmitting}>
              {linkedInRegistration ? "Finish creating account" : "Create account"}
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
