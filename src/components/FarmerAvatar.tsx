import { User } from "lucide-react";
import { useFarmerMediaUrl } from "@/hooks/useFarmerMediaUrl";

interface Props {
  photoUrl: string | null;
  name: string;
  size?: string;
}

const FarmerAvatar = ({ photoUrl, name, size = "h-9 w-9" }: Props) => {
  const signedUrl = useFarmerMediaUrl(photoUrl);

  if (signedUrl) {
    return (
      <img
        src={signedUrl}
        alt={name}
        className={`${size} rounded-full object-cover flex-shrink-0 border border-border`}
      />
    );
  }

  return (
    <div className={`${size} rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0`}>
      <User className="h-4 w-4 text-primary" />
    </div>
  );
};

export default FarmerAvatar;
