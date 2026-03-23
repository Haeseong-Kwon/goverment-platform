import { supabase } from '../supabase';

/**
 * Service to handle all authentication operations through Supabase.
 */

export const signUp = async (email: string, password: string, fullName: string, emailRedirectTo?: string) => {
  if (!supabase) throw new Error('Supabase is not configured.');
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) throw error;
  
  // Create profile if user was created successfully
  if (data.user) {
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: data.user.id,
          full_name: fullName,
          role: 'Student', // Default role
        },
      ]);
    if (profileError) console.error('Error creating profile:', profileError);
  }

  return data;
};

export const signIn = async (email: string, password: string) => {
  if (!supabase) throw new Error('Supabase is not configured.');
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
};

export const signOut = async () => {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getCurrentUser = async () => {
  if (!supabase) return null;
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) return null;
  return user;
};

export const getSession = async () => {
  if (!supabase) return null;
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) return null;
  return session;
};

export const onAuthStateChange = (callback: (user: any) => void) => {
  if (!supabase) return () => {};
  
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });

  return () => subscription.unsubscribe();
};
