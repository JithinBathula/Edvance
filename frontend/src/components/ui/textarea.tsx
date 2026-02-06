import * as React from "react";

import { cn } from "./utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
          "flex-1 px-4 py-3 rounded-md border flex-shrink-0 transition-all duration-300 ease-in-out",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
