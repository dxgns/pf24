export default function UserAvatar({
  image,
  name,
}: {
  image?: string | null;
  name?: string | null;
}) {
  if (!image) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-400 font-bold text-white">
        {name?.charAt(0).toUpperCase() ?? "U"}
      </div>
    );
  }

  return (
    <img
      src={image}
      alt={name ?? "Usuario"}
      className="h-12 w-12 rounded-full"
    />
  );
}