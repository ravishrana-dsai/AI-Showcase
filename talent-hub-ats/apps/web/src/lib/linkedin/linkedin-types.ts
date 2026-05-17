export interface LinkedInExperience {
  company: string;
  title: string;
  starts_at?: { year?: number; month?: number };
  ends_at?: { year?: number; month?: number } | null;
  description?: string;
}

export interface LinkedInProfileData {
  firstName: string;
  lastName: string;
  email: string | null;
  headline: string | null;
  currentTitle: string | null;
  currentCompany: string | null;
  location: string | null;
  linkedinUrl: string;
  skills: string[];
  experience: LinkedInExperience[];
}
