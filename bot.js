const { Client, Intents } = require("discord.js");
const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MEMBERS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.DIRECT_MESSAGES,
        Intents.FLAGS.DIRECT_MESSAGE_TYPING,
        Intents.FLAGS.DIRECT_MESSAGE_REACTIONS
    ],
    partials: ["CHANNEL"]
}) // not sure about intents, though
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
const config = require("./config.json");
const db = require("quick.db");

client.once('ready', async () => {
	console.log(`Logged in as ${client.user.tag}`);
})

client.login(config.token.bot);

client.on("messageCreate", async message => {
	if(message.author.bot) return;
	if(message.content.includes("@everyone") || message.content.includes("@here")) return message.author.send({content: "You're not allowed to use those mentions."});
	console.log("01 no mention, not a bot");
	// Used a new table so it doesn't get messed up with the old one
	const table = new db.table("Support13");
	if(message.channel.type === "DM"){
		let active = await table.get(`support_${message.author.id}`);
		let block = await table.get(`blocked_${message.author.id}`);
		if(block === true) return message.author.send("You are not allowed to use modmail.");
		let guild = await client.guilds.fetch(''); // set the server id here
		let tc = await guild.channels.fetch(''); // set the category id for your tickets here
		let channel, found = true;
		if(active === null){
			await table.add("Tickets", 1);
			let ticket = await table.get("Tickets");
			channel = await guild.channels.create(`${message.author.username}`, {
				type: "GUILD_TEXT",
				topic: `#${ticket} | From ${message.author.username}`,
				parent: tc,
				reason: `${message.author.id} opened a ticket through the modmail service.`
			});
			let author = message.author;
			const newTicketLog = new MessageEmbed()
				.setAuthor(author.tag, author.avatarURL())
				.setDescription(`opened ticket #${ticket}.`)
				.setTimestamp()
				.setColor("0x6666ff")
			let logs = await client.channels.fetch(''); // set the log channel id here
			logs.send({embeds: [newTicketLog]});
			message.author.send(`Hello! Thanks for getting in touch. Our support team will get back to you quickly.`);
			await table.set(`support_${author.id}`, {channel: channel.id, target: message.author.id, ticket: ticket});
			await table.set(`channel_${channel.id}`, {author: message.author.id})
			let support = await table.get(`support_${message.author.id}`);
			let supportchannel = await table.get(`channel_${channel.id}`);
			let text = message.content;
			await channel.send({content: `${message.author.username} opened this ticket.`})
			await channel.send({content: text});
			return;
		};
		channel = guild.channels.cache.get(active.channel);
		let text = message.content;
		channel.send({content: text});
	}
	let activechannel = await table.get(`channel_${message.channel.id}`)
	if(activechannel === null) return; // if no channel is binded, nothing happens
	let activeuser = await table.get(`support_${activechannel.author}`);
	let user = await client.users.fetch(activechannel.author);
	let text = message.content;
	let args = text.split(" ").slice(1);
	let pending = args.join(" ");
	let blocked = await table.get(`blocked_${activechannel.author}`);
	if(message.content.startsWith(`-r`) || message.content.startsWith(`-reply`)){
		if(blocked === true) return message.channel.send({content: "This user is blocked."});
		await user.send(`${message.author.username}: ${pending}`);
		return;
	};
	if(message.content === `-id`){
		return message.channel.send({content: `Ticket owner's ID is **${activechannel.author}**.`});
	}
	if(message.content === `-b` || message.content === `-block`){
		await table.set(`blocked_${activechannel.author}`, true);
		await user.send(`Hi! You can not use modmail anymore.\nOn top of that, you can't contribute or get in touch via any way from now on.`)
		message.channel.send(`This user has been blocked from modmail, and other forms of contribution.`);
		return;
	};
	if(message.content === `-c` || message.content === `-complete`){
		await table.delete(`channel_${message.channel.id}`);
		await table.delete(`support_${activechannel.author}`);
		await user.send({content: "Hi! Your ticket has been closed.\n\nFeel free to DM me whenever it is needed."})
		message.channel.delete();
	};
})
