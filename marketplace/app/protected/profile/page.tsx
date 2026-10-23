"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ProfilePage() {
  const supabase = createClient();
  const [handle, setHandle] = useState("");
  const [country, setCountry] = useState("");
  const [sellerType, setSellerType] = useState("private");
  const [businessName, setBusinessName] = useState("");
  const [vatId, setVatId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (data) {
        setHandle(data.handle);
        setCountry(data.country);
        setSellerType(data.seller_type);
        setBusinessName(data.business_info?.business_name ?? "");
        setVatId(data.business_info?.vat_id ?? "");
      }
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setMessage("You must be signed in.");
      return;
    }
    const row = {
      id: auth.user.id,
      handle: handle.trim().toLowerCase(),
      country: country.trim().toUpperCase(),
      seller_type: sellerType,
      business_info:
        sellerType === "professional"
          ? { business_name: businessName.trim(), vat_id: vatId.trim() }
          : null,
    };
    const { error } = await supabase.from("profiles").upsert(row);
    setMessage(error ? "Error: " + error.message : "Profile saved.");
  }

  if (loading) return <p className="p-6">Loading...</p>;

  const field = "w-full rounded border bg-transparent px-3 py-2";

  return (
    <div className="mx-auto w-full max-w-md space-y-4 p-6">
      <h1 className="text-2xl font-bold">Your profile</h1>
      <form onSubmit={save} className="space-y-4">
        <label className="block">
          <span className="text-sm">Public name (3-20 characters: a-z, 0-9, _)</span>
          <input className={field} value={handle} onChange={(e) => setHandle(e.target.value)} required pattern="[a-zA-Z0-9_]{3,20}" />
        </label>
        <label className="block">
          <span className="text-sm">Country (2-letter code, e.g. IT)</span>
          <input className={field} value={country} onChange={(e) => setCountry(e.target.value)} required maxLength={2} minLength={2} />
        </label>
        <label className="block">
          <span className="text-sm">I sell as</span>
          <select className={field} value={sellerType} onChange={(e) => setSellerType(e.target.value)}>
            <option value="private">A private individual</option>
            <option value="professional">A business or professional</option>
          </select>
        </label>
        {sellerType === "professional" && (
          <>
            <label className="block">
              <span className="text-sm">Business name</span>
              <input className={field} value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
            </label>
            <label className="block">
              <span className="text-sm">VAT number</span>
              <input className={field} value={vatId} onChange={(e) => setVatId(e.target.value)} required />
            </label>
          </>
        )}
        <button type="submit" className="rounded bg-foreground px-4 py-2 text-background">Save profile</button>
      </form>
      {message && <p className="text-sm">{message}</p>}
      <p className="text-sm"><Link className="underline" href="/protected/listings">Back to listings</Link></p>
    </div>
  );
}
