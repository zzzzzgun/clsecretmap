'use server';

import { revalidatePath } from 'next/cache';
import { integer, isoDate, optionalText, text, uuid } from '@/lib/form';
import { requireHousehold } from '@/lib/session';

const FACILITY_COLORS = ['#2f6fde', '#e0782b', '#2a9d6a', '#b04fc4', '#c9483f', '#7a6a2f'];

export async function updateChild(form: FormData) {
  const { supabase, child } = await requireHousehold();
  const { error } = await supabase
    .from('children')
    .update({
      display_name: text(form, 'display_name', { max: 40, required: true }),
      school_name: optionalText(form, 'school_name', 80),
      school_grade: optionalText(form, 'school_grade', 20),
    })
    .eq('id', child.id);
  if (error) throw error;
  revalidatePath('/', 'layout');
}

export async function addFacility(form: FormData) {
  const { supabase, householdId } = await requireHousehold();
  const { count } = await supabase
    .from('facilities')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', householdId);
  const { error } = await supabase.from('facilities').insert({
    household_id: householdId,
    name: text(form, 'name', { max: 80, required: true }),
    color: FACILITY_COLORS[(count ?? 0) % FACILITY_COLORS.length],
  });
  if (error) throw error;
  revalidatePath('/', 'layout');
}

export async function setFacilityArchived(form: FormData) {
  const { supabase } = await requireHousehold();
  const { error } = await supabase
    .from('facilities')
    .update({ archived: form.get('archived') === 'true' })
    .eq('id', uuid(form, 'id'));
  if (error) throw error;
  revalidatePath('/', 'layout');
}

export async function addCertificate(form: FormData) {
  const { supabase, householdId, child } = await requireHousehold();
  const validFrom = isoDate(form, 'valid_from');
  const validUntil = isoDate(form, 'valid_until');
  if (validUntil < validFrom) throw new Error('有効期間の終わりが始まりより前になっています');
  const { error } = await supabase.from('certificates').insert({
    household_id: householdId,
    child_id: child.id,
    valid_from: validFrom,
    valid_until: validUntil,
    monthly_days: integer(form, 'monthly_days', 1, 31),
  });
  if (error) throw error;
  revalidatePath('/', 'layout');
}

export async function deleteCertificate(form: FormData) {
  const { supabase } = await requireHousehold();
  const { error } = await supabase.from('certificates').delete().eq('id', uuid(form, 'id'));
  if (error) throw error;
  revalidatePath('/', 'layout');
}
