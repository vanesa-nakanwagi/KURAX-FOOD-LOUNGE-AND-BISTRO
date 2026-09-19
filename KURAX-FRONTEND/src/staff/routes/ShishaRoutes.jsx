import { Navigate, Route, Routes } from "react-router-dom";
import ShishaDisplay from "../Shisha/ShishaDisplay";

export default function ShishaRoutes() {
  return (
    <Routes>
      <Route path="/" element={<ShishaDisplay />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
