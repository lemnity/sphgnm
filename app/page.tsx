import SphagnumLanding from "@/components/sphagnum-landing";
import { getGallery, getInstagramPosts, getSiteContent } from "@/lib/content/load";

export default async function Page() {
  return <SphagnumLanding content={getSiteContent()} gallery={getGallery()} instagramPosts={getInstagramPosts()} />;
}
