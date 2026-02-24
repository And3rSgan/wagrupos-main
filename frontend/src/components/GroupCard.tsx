import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import GroupsIcon from "@mui/icons-material/Groups";

export type GroupWithAvatar = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  participantCount?: number | null;
};

interface GroupCardProps {
  group: GroupWithAvatar;
  size?: "sm" | "md";
}

export function GroupCard({ group, size = "md" }: GroupCardProps) {
  const isSm = size === "sm";
  const avatarSize = isSm ? 36 : 48;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: isSm ? 1.5 : 2,
        p: isSm ? 1 : 1.5,
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        transition: "all 0.2s",
        "&:hover": {
          borderColor: "primary.main",
          bgcolor: "action.hover",
          boxShadow: 1,
        },
      }}
    >
      <Avatar
        src={group.avatarUrl ?? undefined}
        sx={{
          width: avatarSize,
          height: avatarSize,
          bgcolor: "#25D366",
          flexShrink: 0,
        }}
      >
        <GroupsIcon fontSize={isSm ? "small" : "medium"} />
      </Avatar>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          variant={isSm ? "body2" : "body1"}
          fontWeight={600}
          noWrap
          title={group.name}
        >
          {group.name}
        </Typography>
        {group.participantCount != null && (
          <Typography variant="caption" color="text.secondary">
            {group.participantCount} participante{group.participantCount !== 1 ? "s" : ""}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
