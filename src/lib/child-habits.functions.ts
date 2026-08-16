import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const scheduleSchema = z.union([
  z.object({ type: z.literal("daily") }),
  z.object({ type: z.literal("weekly"), weekdays: z.array(z.number().int().min(0).max(6)) }),
  z.object({ type: z.literal("once"), dates: z.array(z.string().min(1).max(10)) }),
  z.object({ type: z.literal("deadline"), dueDate: z.string().min(1).max(10) }),
]);

async function assertParentOfChild(parentId: string, childId: string) {
  const { data, error } = await supabaseAdmin
    .from("parent_child_links")
    .select("id")
    .eq("parent_user_id", parentId)
    .eq("child_user_id", childId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: not linked to this child");
}

async function assertParentOfHabit(parentId: string, habitId: string) {
  const { data: habit, error } = await supabaseAdmin
    .from("habits")
    .select("user_id")
    .eq("id", habitId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!habit) throw new Error("Habit not found");
  await assertParentOfChild(parentId, habit.user_id);
  return habit.user_id;
}

export const getChildHabits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ childId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertParentOfChild(context.userId, data.childId);
    const { data: habits, error } = await supabaseAdmin
      .from("habits")
      .select("id, name, detail, schedule, completions, created_by")
      .eq("user_id", data.childId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return habits ?? [];
  });

export const addChildHabit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        childId: z.string().uuid(),
        name: z.string().min(1).max(200),
        detail: z.string().max(500).default(""),
        schedule: scheduleSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertParentOfChild(context.userId, data.childId);
    const { data: row, error } = await supabaseAdmin
      .from("habits")
      .insert({
        user_id: data.childId,
        name: data.name,
        detail: data.detail,
        schedule: data.schedule as never,
        completions: [],
        created_by: context.userId,
      })
      .select("id, name, detail, schedule, completions, created_by")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Insert failed");
    return row;
  });

export const updateChildHabitCompletions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        habitId: z.string().uuid(),
        completions: z.array(z.string().min(1).max(10)).max(3650),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertParentOfHabit(context.userId, data.habitId);
    const { error } = await supabaseAdmin
      .from("habits")
      .update({ completions: data.completions })
      .eq("id", data.habitId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteChildHabit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ habitId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertParentOfHabit(context.userId, data.habitId);
    const { error } = await supabaseAdmin.from("habits").delete().eq("id", data.habitId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
