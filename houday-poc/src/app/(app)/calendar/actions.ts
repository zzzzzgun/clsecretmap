'use server';

import { revalidatePath } from 'next/cache';
import { datesInMonth, isIsoMonth, todayInTokyo, weekdayIndex } from '@/lib/domain/dates';
import { isoDate, optionalText, optionalTime, text, uuid } from '@/lib/form';
import { requireHousehold } from '@/lib/session';

export async function addPlan(form: FormData) {
  const { supabase, householdId, child } = await requireHousehold();
  const { error } = await supabase.from('attendance_plans').insert({
    household_id: householdId,
    child_id: child.id,
    facility_id: uuid(form, 'facility_id'),
    date: isoDate(form, 'date'),
    pickup_time: optionalTime(form, 'pickup_time'),
    return_time: optionalTime(form, 'return_time'),
    note: optionalText(form, 'note', 200),
  });
  if (error) throw error;
  revalidatePath('/calendar');
}

/** 「毎週火・木はひまわりデイ」のように、その月の同じ曜日にまとめて入れる */
export async function addWeeklyPlans(form: FormData) {
  const { supabase, householdId, child } = await requireHousehold();
  const month = text(form, 'month', { max: 7, required: true });
  if (!isIsoMonth(month)) throw new Error('月の指定が正しくありません');
  const weekdays = new Set(form.getAll('weekday').map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6));
  if (weekdays.size === 0) throw new Error('曜日を選んでください');

  const today = todayInTokyo();
  const facilityId = uuid(form, 'facility_id');
  const pickupTime = optionalTime(form, 'pickup_time');
  const returnTime = optionalTime(form, 'return_time');

  const rows = datesInMonth(month)
    .filter((date) => date >= today && weekdays.has(weekdayIndex(date)))
    .map((date) => ({
      household_id: householdId,
      child_id: child.id,
      facility_id: facilityId,
      date,
      pickup_time: pickupTime,
      return_time: returnTime,
    }));
  if (rows.length === 0) return;

  const { error } = await supabase.from('attendance_plans').insert(rows);
  if (error) throw error;
  revalidatePath('/calendar');
}

export async function setPlanStatus(form: FormData) {
  const status = form.get('status') === 'cancelled' ? 'cancelled' : 'planned';
  const { supabase } = await requireHousehold();
  const { error } = await supabase.from('attendance_plans').update({ status }).eq('id', uuid(form, 'id'));
  if (error) throw error;
  revalidatePath('/calendar');
}

export async function deletePlan(form: FormData) {
  const { supabase } = await requireHousehold();
  const { error } = await supabase.from('attendance_plans').delete().eq('id', uuid(form, 'id'));
  if (error) throw error;
  revalidatePath('/calendar');
}
