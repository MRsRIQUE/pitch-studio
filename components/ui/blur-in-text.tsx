"use client"

import React from "react"
import clsx from "clsx"
import { motion } from "motion/react"

interface BlurInTextProps {
  text?: string
  className?: string
}

export const BlurInText: React.FC<BlurInTextProps> = ({
  text = "",
  className = "",
}) => {
  const variants1 = {
    hidden: { filter: "blur(10px)", opacity: 0 },
    visible: { filter: "blur(0px)", opacity: 1 },
  }

  return (
    <motion.h1
      initial="hidden"
      animate="visible"
      transition={{ duration: 1 }}
      variants={variants1}
      className={clsx(
        "font-display text-center font-bold drop-shadow-sm tracking-[-0.02em]",
        className
      )}
    >
      {text}
    </motion.h1>
  )
}
