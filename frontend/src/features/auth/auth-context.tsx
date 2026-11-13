"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSupabase } from "./supabase-client";

type Account = {id:string; email:string | null} | null;
type Auth = {user: Account; loading:boolean; configured:boolean; error:string | null; signIn:()=>Promise<void>; signOut:()=>Promise<void>};
const AuthContext = createContext<Auth>({user:null,loading:false,configured:false,error:null,signIn:async()=>{},signOut:async()=>{}});

export function AuthProvider({children}: {children:ReactNode}) {
  const [user, setUser] = useState<Account>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const configured = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  useEffect(() => {
    const supabase = getSupabase();
    let active = true;
    if (!supabase) {Promise.resolve().then(()=>{if(active) setLoading(false);}); return () => {active=false;};}
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session ? {id:session.user.id,email:session.user.email || null} : null);
      setLoading(false);
    });
    supabase.auth.getSession().then(({data,error}) => {
      if (!active) return;
      if (error) setError("Sesiunea nu poate fi încărcată. Autentifică-te din nou.");
      setUser(data.session ? {id:data.session.user.id,email:data.session.user.email || null} : null);
      setLoading(false);
    }).catch(()=>{if(active){setError("Autentificarea nu este disponibilă momentan.");setLoading(false);}});
    return () => {active=false;subscription.unsubscribe();};
  }, []);

  async function signIn() {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Autentificarea online nu este încă configurată.");
    // Open synchronously from the user's click. The original project tab and its
    // temporary image remain untouched; the SDK broadcasts the new session.
    const popup = window.open("about:blank", "forma-sign-in", "popup,width=520,height=720");
    if (!popup) throw new Error("Permite fereastra de autentificare în browser și încearcă din nou.");
    popup.opener = null;
    const base = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");
    try {
      const {data,error} = await supabase.auth.signInWithOAuth({provider:"google",options:{
        redirectTo:`${window.location.origin}${base}/domenii/mobilier/profil/`,skipBrowserRedirect:true,
      }});
      if (error || !data.url) throw new Error("Conectarea Google nu a putut fi pornită. Verifică configurarea autentificării.");
      popup.location.href = data.url;
    } catch {
      popup.close();
      throw new Error("Conectarea Google nu a putut fi pornită. Verifică autentificarea și încearcă din nou.");
    }
  }
  async function signOut() {
    const supabase = getSupabase();
    if (!supabase) return;
    const {error} = await supabase.auth.signOut();
    if (error) throw new Error("Deconectarea nu a putut fi finalizată. Încearcă din nou.");
    setUser(null);
  }
  return <AuthContext.Provider value={{user,loading,configured,error,signIn,signOut}}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
