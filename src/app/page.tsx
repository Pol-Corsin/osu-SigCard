import { redirect } from "next/navigation";

// The landing page is planned for a later phase; the studio is the product for now.
export default function Home() {
  redirect("/studio");
}
