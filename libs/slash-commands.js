import { SlashCommandBuilder } from "discord.js";
import { cacheInteraction, getMoreButtons } from "./globals.js";

export const slashCommands = [
  {
    data: new SlashCommandBuilder()
      .setName("brinken-bot")
      .setDescription(
        "Se alle mulige handlinger og informationer Brinken Botten tilbyder dig"
      ),
    async execute(interaction) {
      await interaction.reply({
        content:
          "Hej! Her er alle de handlinger og informationer jeg kan tilbyde dig!",
        components: [...getMoreButtons("none")],
        ephemeral: true,
      });
      const reply = await interaction.fetchReply();
      cacheInteraction({
        timestamp: reply.createdTimestamp,
        interaction,
        messageId: reply.id,
      });
    },
  },
];
