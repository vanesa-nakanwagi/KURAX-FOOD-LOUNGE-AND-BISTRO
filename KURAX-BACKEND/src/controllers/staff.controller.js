import { supabase } from "../config/supabase.js";

export const getMyStaffProfile = async (req, res) => {
  const userId = req.user.id;

  const { data, error } = await supabase
    .from("staff")
    .select("id, email, role, is_active")
    .eq("user_id", userId)
    .single();

  if (error || !data)
    return res.status(403).json({ message: "Not authorized" });

  if (!data.is_active)
    return res.status(403).json({ message: "Staff not active" });

  res.json(data);
};
