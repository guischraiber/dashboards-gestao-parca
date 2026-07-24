import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Papa from "papaparse";
import MapaAbrangencia from "./MapaAbrangencia.jsx";
const COORD_CIDADES = {
  "CE|Fortaleza":[-3.7166,-38.5423],
  "RS|Santa Maria":[-29.6868,-53.8149],
  "SP|Ribeirao Preto":[-21.1699,-47.8099],
  "PB|Joao Pessoa":[-7.1151,-34.8641],
  "RS|Caxias do Sul":[-29.1629,-51.1792],
  "SP|Braganca Paulista":[-22.9527,-46.5419],
  "MA|Sao Luis":[-2.5387,-44.2825],
  "MS|Campo Grande":[-20.4486,-54.6295],
  "SP|Pindamonhangaba":[-22.9246,-45.4613],
  "SC|Blumenau":[-26.9155,-49.0709],
  "RJ|Angra dos Reis":[-23.0011,-44.3196],
  "SP|Cubatao":[-23.8911,-46.424],
  "MG|Juiz de Fora":[-21.7595,-43.3398],
  "SC|Brusque":[-27.0977,-48.9107],
  "RN|Natal":[-5.7936,-35.1986],
  "AL|Maceio":[-9.666,-35.735],
  "SP|Bauru":[-22.3246,-49.0871],
  "RS|Pelotas":[-31.7649,-52.3371],
  "SP|Sao Sebastiao":[-23.7951,-45.4143],
  "SP|Franca":[-20.5352,-47.4039],
  "SP|Guaratingueta":[-22.8075,-45.1938],
  "MT|Cuiaba":[-15.601,-56.0974],
  "SP|Sao Jose do Rio Preto":[-20.8113,-49.3758],
  "SP|Itapetininga":[-23.5886,-48.0483],
  "RS|Passo Fundo":[-28.2576,-52.4091],
  "SP|Sao Carlos":[-22.0174,-47.886],
  "SP|Ubatuba":[-23.4332,-45.0834],
  "SP|Fernandopolis":[-20.2806,-50.2471],
  "SP|Caraguatatuba":[-23.6125,-45.4125],
  "SC|Criciuma":[-28.6723,-49.3729],
  "SP|Aracatuba":[-21.2076,-50.4401],
  "BA|Itabuna":[-14.7876,-39.2781],
  "MG|Governador Valadares":[-18.8545,-41.9555],
  "SC|Chapeco":[-27.1004,-52.6152],
  "SP|Cotia":[-23.6022,-46.919],
  "PI|Teresina":[-5.0919,-42.8034],
  "RS|Rio Grande":[-32.0349,-52.1071],
  "ES|Serra":[-20.121,-40.3074],
  "SP|Catanduva":[-21.1314,-48.977],
  "SE|Aracaju":[-10.9091,-37.0677],
  "RS|Cerro Grande do Sul":[-30.5905,-51.7418],
  "SP|Birigui":[-21.291,-50.3432],
  "SP|Pirassununga":[-21.996,-47.4257],
  "SP|Itapeva":[-23.9788,-48.8764],
  "SP|Botucatu":[-22.8837,-48.4437],
  "SC|Biguacu":[-27.496,-48.6598],
  "PA|Belem":[-1.4554,-48.4898],
  "MG|Divinopolis":[-20.1446,-44.8912],
  "RS|Santa Cruz do Sul":[-29.722,-52.4343],
  "ES|Vitoria":[-20.3155,-40.3128],
  "SP|Lorena":[-22.7334,-45.1197],
  "SP|Araraquara":[-21.7845,-48.178],
  "RS|Erechim":[-27.6364,-52.2697],
  "PE|Caruaru":[-8.2845,-35.9699],
  "TO|Palmas":[-10.24,-48.3558],
  "SP|Amparo":[-22.7088,-46.772],
  "RN|Parnamirim":[-5.9112,-35.271],
  "RN|Mossoro":[-5.1837,-37.3474],
  "MS|Dourados":[-22.2231,-54.812],
  "ES|Vila Velha":[-20.3417,-40.2875],
  "SP|Avare":[-23.1067,-48.9251],
  "BA|Luis Eduardo Magalhaes":[-12.0956,-45.7866],
  "MT|Varzea Grande":[-15.6458,-56.1322],
  "RS|Uruguaiana":[-29.7614,-57.0853],
  "CE|Juazeiro do Norte":[-7.1962,-39.3076],
  "SP|Matao":[-21.6025,-48.364],
  "SP|Guararema":[-23.4112,-46.0369],
  "SP|Serrana":[-21.2043,-47.5952],
  "PE|Petrolina":[-9.3887,-40.5027],
  "SP|Ibitinga":[-21.7562,-48.8319],
  "ES|Sao Mateus":[-18.7214,-39.8579],
  "SP|Santa Fe do Sul":[-20.2083,-50.932],
  "MG|Extrema":[-22.854,-46.3178],
  "SC|Ararangua":[-28.9356,-49.4918],
  "BA|Barreiras":[-12.1439,-44.9968],
  "PR|Campo Largo":[-25.4525,-49.529],
  "SP|Sertaozinho":[-21.1316,-47.9875],
  "SP|Santa Isabel":[-23.3172,-46.2237],
  "MA|Imperatriz":[-5.5185,-47.4777],
  "PB|Campina Grande":[-7.222,-35.8731],
  "SP|Registro":[-24.4979,-47.8449],
  "BA|Jequie":[-13.8509,-40.0877],
  "SP|Sao Paulo":[-23.5329,-46.6395],
  "SP|Igarata":[-23.2037,-46.157],
  "SP|Jales":[-20.2672,-50.5494],
  "SP|Jaboticabal":[-21.252,-48.3252],
  "RJ|Tres Rios":[-22.1165,-43.2185],
  "SC|Jaragua do Sul":[-26.4851,-49.0713],
  "SP|Votuporanga":[-20.4237,-49.9781],
  "ES|Cachoeiro de Itapemirim":[-20.8462,-41.1198],
  "SP|Itapevi":[-23.5488,-46.9327],
  "MT|Sinop":[-11.8604,-55.5091],
  "SP|Cruzeiro":[-22.5728,-44.969],
  "MS|Tres Lagoas":[-20.7849,-51.7007],
  "SP|Guariba":[-21.3594,-48.2316],
  "SP|Andradina":[-20.8948,-51.3786],
  "MG|Mario Campos":[-20.0582,-44.1883],
  "MG|Conselheiro Lafaiete":[-20.6634,-43.7846],
  "RJ|Paraty":[-23.2221,-44.7175],
  "SP|Sao Jose do Rio Pardo":[-21.5953,-46.8873],
  "SC|Guabiruba":[-27.0808,-48.9804],
  "SP|Ilhabela":[-23.7785,-45.3552],
  "SP|Franco da Rocha":[-23.3229,-46.729],
  "SP|Penapolis":[-21.4148,-50.0769],
  "SP|Bebedouro":[-20.9491,-48.4791],
  "SP|Lencois Paulista":[-22.6027,-48.8037],
  "SP|Sao Roque":[-23.5226,-47.1357],
  "RS|Lajeado":[-29.4591,-51.9644],
  "SP|Pontal":[-21.0216,-48.0423],
  "SP|Barretos":[-20.5531,-48.5698],
  "RJ|Rio de Janeiro":[-22.9129,-43.2003],
  "SP|Itapira":[-22.4357,-46.8224],
  "SP|Aparecida":[-22.8495,-45.2325],
  "RS|Bento Goncalves":[-29.1662,-51.5165],
  "SP|Francisco Morato":[-23.2792,-46.7448],
  "SP|Ilha Comprida":[-24.7307,-47.5383],
  "SP|Sao Pedro":[-22.5483,-47.9096],
  "SP|Itarare":[-24.1085,-49.3352],
  "RS|Alegrete":[-29.7902,-55.7949],
  "SC|Concordia":[-27.2335,-52.026],
  "MG|Pouso Alegre":[-22.2266,-45.9389],
  "SP|Guararapes":[-21.2544,-50.6453],
  "SP|Santa Rita do Passa Quatro":[-21.7083,-47.478],
  "MG|Mateus Leme":[-19.9794,-44.4318],
  "RJ|Paraiba do Sul":[-22.1585,-43.304],
  "GO|Vianopolis":[-16.7405,-48.5159],
  "SC|Lages":[-27.815,-50.3259],
  "RS|Santana do Livramento":[-30.8906,-55.5317],
  "SP|Santana de Parnaiba":[-23.4439,-46.9178],
  "MG|Pirapora":[-17.3392,-44.934],
  "SP|Campos do Jordao":[-22.7296,-45.5833],
  "RS|Canela":[-29.356,-50.8119],
  "RS|Bage":[-31.3297,-54.0999],
  "SP|Taquaritinga":[-21.4049,-48.5103],
  "SP|Iguape":[-24.699,-47.5537],
  "SP|Embu Guacu":[-23.8339,-46.8105],
  "RS|Xangri La":[-29.8306,-50.0548],
  "MG|Timoteo":[-19.5811,-42.6471],
  "SP|Monte Azul Paulista":[-20.9065,-48.6387],
  "SP|Ilha Solteira":[-20.4326,-51.3426],
  "SP|Dracena":[-21.4843,-51.535],
  "MG|Ouro Preto":[-20.3796,-43.512],
  "BA|Ilheus":[-14.793,-39.046],
  "SP|Angatuba":[-23.4917,-48.4139],
  "SC|Guaramirim":[-26.4688,-49.0026],
  "PR|Santo Antonio do Sudoeste":[-26.0737,-53.7251],
  "MG|Formiga":[-20.4618,-45.4268],
  "RS|Tapejara":[-28.0652,-52.0097],
  "SC|Balneario Picarras":[-26.7639,-48.6717],
  "SP|Tremembe":[-22.9571,-45.5475],
  "SP|Monte Alto":[-21.2655,-48.4971],
  "SP|Orlandia":[-20.7169,-47.8852],
  "PR|Marechal Candido Rondon":[-24.557,-54.0571],
  "GO|Jatai":[-17.8784,-51.7204],
  "MG|Teofilo Otoni":[-17.8595,-41.5087],
  "SC|Balneario Camboriu":[-26.9926,-48.6352],
  "RS|Tramandai":[-29.9841,-50.1322],
  "MG|Campo Belo":[-20.8932,-45.2699],
  "PR|Imbau":[-24.448,-50.7533],
  "MG|Coronel Fabriciano":[-19.5179,-42.6276],
  "RS|Sao Gabriel":[-30.3337,-54.3217],
  "PI|Picos":[-7.0772,-41.467],
  "RS|Viamao":[-30.0819,-51.0194],
  "MG|Ipatinga":[-19.4703,-42.5476],
  "SP|Biritiba Mirim":[-23.5711,-46.0453],
  "RS|Guaiba":[-30.1086,-51.3233],
  "RS|Soledade":[-28.8306,-52.5131],
  "ES|Cariacica":[-20.2632,-40.4165],
  "PE|Ipojuca":[-8.393,-35.0609],
  "SP|Cravinhos":[-21.338,-47.7324],
  "SP|Itajobi":[-21.3123,-49.0629],
  "SC|Canoinhas":[-26.1766,-50.395],
  "RS|Santo angelo":[-28.3001,-54.2668],
  "MT|Rondonopolis":[-16.4673,-54.6372],
  "SP|Lins":[-21.6718,-49.7526],
  "RS|Cacapava do Sul":[-30.5144,-53.4827],
  "SP|alvares Machado":[-22.0764,-51.4722],
  "PE|Santa Cruz do Capibaribe":[-7.948,-36.2061],
  "MT|Alta Floresta":[-9.8667,-56.0867],
  "SC|Itaiopolis":[-26.339,-49.9092],
  "MG|Sao Joao Del Rei":[-21.1311,-44.2526],
  "ES|Mimoso do Sul":[-21.0628,-41.3615],
  "RS|Panambi":[-28.2833,-53.5023],
  "MG|Manhuacu":[-20.2572,-42.028],
  "SC|Schroeder":[-26.4116,-49.074],
  "PE|Serra Talhada":[-7.9818,-38.289],
  "BA|Jaguarari":[-10.2569,-40.1999],
  "SC|Cacador":[-26.7757,-51.012],
  "SP|Jose Bonifacio":[-21.0551,-49.6892],
  "ES|Guarapari":[-20.6772,-40.5093],
  "PI|Piripiri":[-4.2716,-41.7716],
  "SP|Paraibuna":[-23.3872,-45.6639],
  "MG|Guape":[-20.7631,-45.9152],
  "SP|Pradopolis":[-21.3626,-48.0679],
  "BA|Malhada de Pedras":[-14.3847,-41.8842],
  "RS|Catuipe":[-28.2554,-54.0132],
  "SP|Ibate":[-21.9584,-47.9882],
  "MT|Sorriso":[-12.5425,-55.7211],
  "BA|Mucuge":[-13.0053,-41.3703],
  "SC|Bombinhas":[-27.1382,-48.5146],
  "MT|Tangara da Serra":[-14.6229,-57.4933],
  "RS|Cangucu":[-31.396,-52.6783],
  "MG|Medina":[-16.2245,-41.4728],
  "SP|Porangaba":[-23.1761,-48.1195],
  "PI|Parnaiba":[-2.9059,-41.7754],
  "SC|Sombrio":[-29.108,-49.6328],
  "BA|Vera Cruz":[-12.9568,-38.6153],
  "SP|Santo Antonio do Pinhal":[-22.827,-45.663],
  "SP|Americo Brasiliense":[-21.7288,-48.1147],
  "MS|Nova Andradina":[-22.238,-53.3437],
  "SC|Mafra":[-26.1159,-49.8086],
  "MG|Paracatu":[-17.2252,-46.8711],
  "ES|Ibatiba":[-20.2347,-41.5087],
  "BA|Porto Seguro":[-16.4435,-39.0643],
  "BA|Itaberaba":[-12.5242,-40.3059],
  "PE|Araripina":[-7.5707,-40.494],
  "RJ|Areal":[-22.2283,-43.1118],
  "SP|Novo Horizonte":[-21.4651,-49.2234],
  "SP|Mirante do Paranapanema":[-22.2904,-51.9084],
  "SC|Sao Miguel do Oeste":[-26.7242,-53.5163],
  "SP|Jardinopolis":[-21.0176,-47.7606],
  "PR|Laranjeiras do Sul":[-25.4077,-52.4109],
  "MA|Paco do Lumiar":[-2.5166,-44.1019],
  "BA|Baixa Grande":[-11.9519,-40.169],
  "CE|Senador Pompeu":[-5.5824,-39.3704],
  "SC|Ituporanga":[-27.4101,-49.5963],
  "SC|Araquari":[-26.3754,-48.7188],
  "MA|Sao Jose de Ribamar":[-2.547,-44.0597],
  "MG|Joao Monlevade":[-19.8126,-43.1735],
  "GO|Senador Canedo":[-16.7084,-49.0914],
  "SE|Barra dos Coqueiros":[-10.8996,-37.0323],
  "MG|Muriae":[-21.13,-42.3693],
  "SP|Sao Bento do Sapucai":[-22.6837,-45.7287],
  "SP|Auriflama":[-20.6836,-50.5572],
  "SP|Jau":[-22.2936,-48.5592],
  "CE|Horizonte":[-4.1209,-38.4707],
  "SP|Caieiras":[-23.3607,-46.7397],
  "SP|Pereira Barreto":[-20.6368,-51.1123],
  "MS|Corumba":[-19.0077,-57.651],
  "AL|Girau do Ponciano":[-9.884,-36.8316],
  "SP|Iacanga":[-21.8896,-49.031],
  "SP|Mirassol":[-20.8169,-49.5206],
  "GO|Posse":[-14.0859,-46.3704],
  "SC|Joacaba":[-27.1721,-51.5108],
  "SP|Porto Ferreira":[-21.8498,-47.487],
  "GO|Neropolis":[-16.4047,-49.2227],
  "PI|Luzilandia":[-3.4683,-42.3718],
  "CE|Iguatu":[-6.3628,-39.2892],
  "CE|Quixeramobim":[-5.1907,-39.2889],
  "SP|Cordeiropolis":[-22.4778,-47.4519],
  "SP|Taquarituba":[-23.5307,-49.241],
  "SP|Batatais":[-20.8929,-47.5921],
  "SP|Ipua":[-20.4438,-48.0129],
  "SC|Maravilha":[-26.7665,-53.1737],
  "SP|Campinas":[-22.9053,-47.0659],
  "CE|Ico":[-6.3963,-38.8554],
  "SP|Mogi das Cruzes":[-23.5208,-46.1854],
  "RS|Venancio Aires":[-29.6143,-52.1932],
  "GO|Corumbaiba":[-18.1415,-48.5626],
  "SP|Parapua":[-21.7792,-50.7949],
  "SP|Juquia":[-24.3101,-47.6426],
  "MG|Santana do Paraiso":[-19.3661,-42.5446],
  "MG|Uba":[-21.1204,-42.9359],
  "CE|Caninde":[-4.3516,-39.3155],
  "MG|Sao Sebastiao do Paraiso":[-20.9167,-46.9837],
  "SP|Morro Agudo":[-20.7288,-48.0581],
  "PR|Terra Boa":[-23.7683,-52.447],
  "SP|Santa Adelia":[-21.2427,-48.8063],
  "SP|Santo Anastacio":[-21.9747,-51.6527],
  "MT|Pontes e Lacerda":[-15.2219,-59.3435],
  "BA|Rio do Pires":[-13.1185,-42.2902],
  "PR|Santa Fe":[-23.04,-51.808],
  "SP|Cajobi":[-20.8773,-48.8063],
  "MG|Tiradentes":[-21.1102,-44.1744],
  "BA|Sento Se":[-9.7414,-41.8786],
  "SP|Presidente Venceslau":[-21.8732,-51.8447],
  "SP|Sao Joao da Boa Vista":[-21.9707,-46.7944],
  "PR|Pien":[-26.0965,-49.4336],
  "SP|Guaraci":[-20.4977,-48.9391],
  "SP|Valentim Gentil":[-20.4217,-50.0889],
  "BA|Bom Jesus da Lapa":[-13.2506,-43.4108],
  "SP|Capao Bonito":[-24.0113,-48.3482],
  "BA|Teixeira de Freitas":[-17.5399,-39.74],
  "SP|Embu das Artes":[-23.6437,-46.8579],
  "SC|Sao Lourenco do Oeste":[-26.3557,-52.8498],
  "MG|Piranga":[-20.6834,-43.2967],
  "GO|Formosa":[-15.54,-47.337],
  "BA|Itacare":[-14.2784,-38.9959],
  "SP|Brotas":[-22.2795,-48.1251],
  "RS|Flores da Cunha":[-29.0261,-51.1875],
  "GO|Ipora":[-16.4398,-51.118],
  "ES|Domingos Martins":[-20.3603,-40.6594],
  "MG|Para de Minas":[-19.8534,-44.6114],
  "SC|Sao Bento do Sul":[-26.2495,-49.3831],
  "AL|Arapiraca":[-9.7549,-36.6615],
  "PB|Cabedelo":[-6.9873,-34.8284],
  "MG|Belo Horizonte":[-19.9102,-43.9266],
  "RJ|Aperibe":[-21.6252,-42.1017],
  "SP|Irapuru":[-21.5684,-51.3472],
  "SP|Presidente Epitacio":[-21.7651,-52.1111],
  "SP|Guaira":[-20.3196,-48.312],
  "BA|Mutuipe":[-13.2284,-39.5044],
  "GO|Goianesia":[-15.3118,-49.1162],
  "RS|Santa Vitoria do Palmar":[-33.525,-53.3717],
  "CE|Sobral":[-3.6891,-40.3482],
  "CE|Mauriti":[-7.386,-38.7708],
  "SP|Barrinha":[-21.1864,-48.1636],
  "MG|Passos":[-20.7193,-46.609],
  "MG|Paraopeba":[-19.2732,-44.4044],
  "SP|Regente Feijo":[-22.2181,-51.3055],
  "RS|Gramado":[-29.3734,-50.8762],
  "SP|Piraju":[-23.1981,-49.3803],
  "MS|Chapadao do Sul":[-18.788,-52.6263],
  "RS|Osorio":[-29.8881,-50.2667],
  "PR|Ubirata":[-24.5393,-52.9865],
  "PR|Bom Sucesso":[-23.7063,-51.7671],
  "RS|Rosario do Sul":[-30.2515,-54.9221],
  "RS|Jaguarao":[-32.5604,-53.377],
  "SP|Santa Rosa de Viterbo":[-21.4776,-47.3622],
  "PE|Garanhuns":[-8.8824,-36.4966],
  "MA|Balsas":[-7.5321,-46.0372],
  "SP|Meridiano":[-20.3579,-50.1811],
  "ES|Guacui":[-20.7668,-41.6734],
  "SP|Paranapanema":[-23.3862,-48.7214],
  "BA|Serra do Ramalho":[-13.5659,-43.5929],
  "SP|Sao Joaquim da Barra":[-20.5812,-47.8593],
  "SP|Mirandopolis":[-21.1313,-51.1035],
  "MG|Virginopolis":[-18.8154,-42.7015],
  "MG|Capelinha":[-17.6888,-42.5147],
  "SC|Quilombo":[-26.7264,-52.724],
  "MG|Santa Vitoria":[-18.8414,-50.1208],
  "RS|Porto Xavier":[-27.9082,-55.1379],
  "SP|Fernando Prestes":[-21.2661,-48.6874],
  "SP|Igarapava":[-20.0407,-47.7466],
  "CE|Maranguape":[-3.8914,-38.6829],
  "MA|Presidente Dutra":[-5.2898,-44.495],
  "MS|Bataguassu":[-21.7159,-52.4221],
  "GO|Itumbiara":[-18.4093,-49.2158],
  "PR|Ribeirao Claro":[-23.1941,-49.7597],
  "SP|Ibira":[-21.083,-49.2448],
  "SC|Porto Belo":[-27.1586,-48.5469],
  "RS|Cachoeira do Sul":[-30.033,-52.8928],
  "RS|Rio Pardo":[-29.988,-52.3711],
  "MG|Itamarandiba":[-17.8552,-42.8561],
  "MG|Itamonte":[-22.2859,-44.868],
  "SP|Pirajui":[-21.999,-49.4608],
  "CE|Maracanau":[-3.867,-38.6259],
  "SP|Iepe":[-22.6602,-51.0779],
  "ES|Muniz Freire":[-20.4652,-41.4156],
  "PR|Sao Mateus do Sul":[-25.8677,-50.384],
  "BA|Salvador":[-12.9718,-38.5011],
  "PR|Marilena":[-22.7336,-53.0402],
  "SP|Pedro de Toledo":[-24.2764,-47.2354],
  "SC|Presidente Getulio":[-27.0474,-49.6246],
  "RS|Estancia Velha":[-29.6535,-51.1843],
  "SC|Balneario Gaivota":[-29.1527,-49.5841],
  "BA|Caetite":[-14.0684,-42.4861],
  "ES|Conceicao da Barra":[-18.5883,-39.7362],
  "MG|Santa Maria do Suacui":[-18.1896,-42.4139],
  "PB|Guarabira":[-6.8506,-35.485],
  "GO|Planaltina":[-15.452,-47.6089],
  "MG|Itauna":[-20.0818,-44.5801],
  "ES|Anchieta":[-20.7955,-40.6425],
  "SP|Pratania":[-22.8112,-48.6636],
  "SP|Oriente":[-22.1549,-50.0971],
  "SP|Viradouro":[-20.8734,-48.293],
  "MG|Capela Nova":[-20.9179,-43.622],
  "SC|Urussanga":[-28.518,-49.3238],
  "MA|Timon":[-5.0977,-42.8329],
  "MG|Barao de Cocais":[-19.9389,-43.4755],
  "PE|Belo Jardim":[-8.3313,-36.4258],
  "SP|Dobrada":[-21.5155,-48.3935],
  "SP|Joao Ramalho":[-22.2473,-50.7694],
  "PR|Pato Branco":[-26.2292,-52.6706],
  "SP|Monteiro Lobato":[-22.9544,-45.8407],
  "MG|Itapecerica":[-20.4704,-45.127],
  "ES|Venda Nova do Imigrante":[-20.327,-41.1355],
  "SP|Bastos":[-21.921,-50.7357],
  "RS|Pedro Osorio":[-31.8642,-52.8184],
  "SP|Palmeira DOeste":[-20.4133,-50.7567],
  "MG|Urucania":[-20.3521,-42.737],
  "RS|Nova Petropolis":[-29.3741,-51.1136],
  "SC|Curitibanos":[-27.2824,-50.5816],
  "MA|Governador Eugenio Barros":[-5.319,-44.2469],
  "SP|Buritama":[-21.0661,-50.1475],
  "BA|Urucuca":[-14.5963,-39.2851],
  "MT|Canarana":[-13.5515,-52.2705],
  "BA|Coracao de Maria":[-12.2333,-38.7487],
  "GO|Divinopolis de Goias":[-13.2853,-46.3999],
  "MG|Arceburgo":[-21.359,-46.9401],
  "SP|Severinia":[-20.8108,-48.8054],
  "SP|Junqueiropolis":[-21.5103,-51.4342],
  "PB|Patos":[-7.0174,-37.2747],
  "SC|Dionisio Cerqueira":[-26.2648,-53.6351],
  "MG|Ladainha":[-17.6279,-41.7488],
  "SC|Cocal do Sul":[-28.5986,-49.3335],
  "SP|Colina":[-20.7114,-48.5387],
  "MG|Jaboticatubas":[-19.5119,-43.7373],
  "BA|Morro do Chapeu":[-11.5488,-41.1565],
  "SP|Aguai":[-22.0572,-46.9735],
  "SP|Dourado":[-22.1044,-48.3178],
  "PR|Curitiba":[-25.4195,-49.2646],
  "BA|Mirante":[-14.2385,-40.7718],
  "BA|Dias Davila":[-12.6127,-38.2986],
  "SP|Roseira":[-22.8938,-45.307],
  "MG|aguas Formosas":[-17.0802,-40.9384],
  "MG|Engenheiro Caldas":[-19.2065,-42.0503],
  "SC|Capivari de Baixo":[-28.4498,-48.9631],
  "RS|Santiago":[-29.1897,-54.8666],
  "MG|Resende Costa":[-20.9171,-44.2407],
  "RJ|Quissama":[-22.1031,-41.4693],
  "SC|Tijucas":[-27.2354,-48.6322],
  "MG|Coroaci":[-18.6156,-42.2791],
  "SP|Cajuru":[-21.2749,-47.303],
  "PR|Salto do Lontra":[-25.7813,-53.3135],
  "SP|Descalvado":[-21.9002,-47.6181],
  "RJ|Trajano de Moraes":[-22.0638,-42.0643],
  "PE|Salgueiro":[-8.0737,-39.1247],
  "BA|Mucuri":[-18.0754,-39.5565],
  "SP|Charqueada":[-22.5096,-47.7755],
  "ES|Jeronimo Monteiro":[-20.7994,-41.3948],
  "RS|Arroio do Sal":[-29.5439,-49.8895],
  "MG|Mantena":[-18.7761,-40.9874],
  "MS|Ribas do Rio Pardo":[-20.4445,-53.7588],
  "CE|Eusebio":[-3.8925,-38.4559],
  "MG|Tres Coracoes":[-21.6921,-45.2511],
  "PE|Sao Bento do Una":[-8.5264,-36.4465],
  "RJ|Itaocara":[-21.6748,-42.0758],
  "ES|Viana":[-20.3825,-40.4933],
  "BA|Crisopolis":[-11.5059,-38.1515],
  "SP|Jacupiranga":[-24.6963,-48.0064],
  "MA|Pinheiro":[-2.5222,-45.0788],
  "PR|Ivate":[-23.4072,-53.3687],
  "RS|Ibiruba":[-28.6302,-53.0961],
  "SP|Santo Antonio do Aracangua":[-20.9331,-50.498],
  "PI|Oeiras":[-7.0191,-42.1283],
  "RS|Torres":[-29.3334,-49.7333],
  "RS|Carazinho":[-28.2958,-52.7933],
  "RS|Imbe":[-29.9753,-50.1281],
  "AL|Piranhas":[-9.624,-37.757],
  "RS|Ijui":[-28.388,-53.92],
  "BA|Santa Maria da Vitoria":[-13.3859,-44.2011],
  "MA|Ze Doca":[-3.2701,-45.6553],
  "SP|Mococa":[-21.4647,-47.0024],
  "ES|Alfredo Chaves":[-20.6396,-40.7543],
  "GO|aguas Lindas de Goias":[-15.7617,-48.2816],
  "BA|Iraquara":[-12.2429,-41.6155],
  "MG|aguas Vermelhas":[-15.7431,-41.4571],
  "MT|Primavera do Leste":[-15.544,-54.2811],
  "RS|Tres Passos":[-27.4555,-53.9296],
  "MG|Mar de Espanha":[-21.8707,-43.0062],
  "SE|Umbauba":[-11.3809,-37.6623],
  "SP|Pederneiras":[-22.3511,-48.7781],
  "ES|Presidente Kennedy":[-21.0964,-41.0468],
  "SP|Martinopolis":[-22.1462,-51.1709],
  "RS|Ararica":[-29.6168,-50.9291],
  "BA|Ituacu":[-13.8107,-41.3003],
  "SC|Icara":[-28.7132,-49.3087],
  "MG|Santos Dumont":[-21.4634,-43.5499],
  "PR|Realeza":[-25.7711,-53.526],
  "MG|Bom Despacho":[-19.7386,-45.2622],
  "MT|Santa Carmem":[-11.9125,-55.2263],
  "ES|Muqui":[-20.9509,-41.346],
  "RN|Montanhas":[-6.4852,-35.2842],
  "SE|Itaporanga DAjuda":[-11.1672,-37.3183],
  "SP|Tambau":[-21.7029,-47.2703],
  "PR|Candido de Abreu":[-24.5649,-51.3372],
  "SC|Indaial":[-26.8992,-49.2354],
  "SP|Sao Manuel":[-22.7321,-48.5723],
  "RS|Vacaria":[-28.5079,-50.9418],
  "ES|Castelo":[-20.6033,-41.2031],
  "CE|Aracoiaba":[-4.3687,-38.8125],
  "SE|Poco Verde":[-10.7151,-38.1813],
  "CE|Paracuru":[-3.4144,-39.03],
  "PR|Balsa Nova":[-25.5804,-49.6291],
  "ES|Santa Teresa":[-19.9363,-40.5979],
  "SP|Guzolandia":[-20.6467,-50.6645],
  "MG|Januaria":[-15.4802,-44.3639],
  "SP|Ouroeste":[-20.0061,-50.3768],
  "RS|Marau":[-28.4498,-52.1986],
  "PA|Parauapebas":[-6.0678,-49.9037],
  "MG|Mariana":[-20.3765,-43.414],
  "PR|Santa Helena":[-24.8585,-54.336],
  "SP|Cachoeira Paulista":[-22.6665,-45.0154],
  "MG|Raul Soares":[-20.1061,-42.4502],
  "MG|Itabira":[-19.6239,-43.2312],
  "RS|Toropi":[-29.4782,-54.2244],
  "SP|Pedregulho":[-20.2535,-47.4775],
  "SP|Serra Negra":[-22.6139,-46.7033],
  "SP|Ituverava":[-20.3355,-47.7902],
  "SP|Santos":[-23.9535,-46.335],
  "PR|Ibipora":[-23.2659,-51.0522],
  "MG|Itajuba":[-22.4225,-45.4598],
  "MT|Sao Jose do Rio Claro":[-13.4398,-56.7218],
  "SP|Potim":[-22.8343,-45.2552],
  "ES|Nova Venecia":[-18.715,-40.4053],
  "BA|Itabela":[-16.5732,-39.5593],
  "SP|Itai":[-23.4213,-49.092],
  "SP|Vargem":[-22.887,-46.4124],
  "SP|Bady Bassitt":[-20.9197,-49.4385],
  "BA|Mata de Sao Joao":[-12.5307,-38.3009],
  "ES|Iconha":[-20.7913,-40.8132],
  "SP|Urupes":[-21.2032,-49.2931],
  "PR|Quatigua":[-23.5671,-49.916],
  "SC|Urubici":[-28.0157,-49.5925],
  "SE|Boquim":[-11.1397,-37.6195],
  "MG|Lavras":[-21.248,-45.0009],
  "RS|Tres Cachoeiras":[-29.4487,-49.9275],
  "AL|Coruripe":[-10.1276,-36.1717],
  "PE|Cabo de Santo Agostinho":[-8.2822,-35.0253],
  "SC|Porto Uniao":[-26.2451,-51.0759],
  "RS|Itaqui":[-29.1311,-56.5515],
  "CE|Icapui":[-4.7121,-37.3531],
  "MG|Itatiaiucu":[-20.1983,-44.4211],
  "SP|Piracicaba":[-22.7338,-47.6476],
  "MS|Sonora":[-17.5698,-54.7551],
  "SC|Tres Barras":[-26.1056,-50.3197],
  "SP|Santa Cruz do Rio Pardo":[-22.8988,-49.6354],
  "RS|Charqueadas":[-29.9625,-51.6289],
  "PR|Santa Tereza do Oeste":[-25.0543,-53.6274],
  "BA|Condeuba":[-14.9022,-41.9718],
  "SP|Barra Bonita":[-22.4909,-48.5583],
  "MG|Varginha":[-21.5556,-45.4364],
  "RS|Pinto Bandeira":[-29.0975,-51.4503],
  "ES|Marechal Floriano":[-20.4159,-40.67],
  "ES|Atilio Vivacqua":[-20.913,-41.1986],
  "RS|Butia":[-30.1179,-51.9601],
  "MG|Perdizes":[-19.3434,-47.2963],
  "SP|Bananal":[-22.6819,-44.3281],
  "MG|Conselheiro Pena":[-19.1789,-41.4736],
  "MG|Santa Margarida":[-20.3839,-42.2519],
  "RS|Horizontina":[-27.6282,-54.3053],
  "CE|Itaitinga":[-3.9658,-38.5298],
  "PB|Alhandra":[-7.4298,-34.9057],
  "PR|Coronel Domingos Soares":[-26.2277,-52.0356],
  "PR|Francisco Beltrao":[-26.0817,-53.0535],
  "MG|Pocos de Caldas":[-21.78,-46.5692],
  "GO|Alto Paraiso de Goias":[-14.1305,-47.51],
  "GO|Inhumas":[-16.3611,-49.5001],
  "ES|Vargem Alta":[-20.669,-41.0179],
  "BA|Itagi":[-14.1615,-40.0131],
  "SP|Sao Jose dos Campos":[-23.1896,-45.8841],
  "SP|Itapolis":[-21.5942,-48.8149],
  "ES|Linhares":[-19.3946,-40.0643],
  "SC|Rio Negrinho":[-26.2591,-49.5177],
  "PR|Jaguariaiva":[-24.2439,-49.7066],
  "AL|Delmiro Gouveia":[-9.3853,-37.9987],
  "BA|Sao Jose do Jacuipe":[-11.4137,-39.8669],
  "MG|Oliveira":[-20.6982,-44.829],
  "MG|Mamonas":[-15.0479,-42.9469],
  "BA|Pilao Arcado":[-10.0051,-42.4936],
  "PR|Lapa":[-25.7671,-49.7168],
  "SP|Indaiatuba":[-23.0816,-47.2101],
  "CE|Crateus":[-5.1677,-40.6536],
  "SP|Saltinho":[-22.8442,-47.6754],
  "SP|Conchas":[-23.0154,-48.0134],
  "CE|Tabuleiro do Norte":[-5.2435,-38.1282],
  "MA|Itapecuru Mirim":[-3.402,-44.3508],
  "PR|Imbituva":[-25.2285,-50.5989],
  "SC|Pomerode":[-26.7384,-49.1785],
  "MG|Cambui":[-22.6115,-46.0572],
  "SP|Itapui":[-22.2324,-48.7197],
  "SP|Bariri":[-22.073,-48.7438],
  "MG|Joao Pinheiro":[-17.7398,-46.1715],
  "SP|Sao Miguel Arcanjo":[-23.8782,-47.9935],
  "RS|Cerro Largo":[-28.1463,-54.7428],
  "RS|Sao Jose do Norte":[-32.0151,-52.0331],
  "SP|Tabatinga":[-21.7239,-48.6896],
  "BA|Ibipeba":[-11.6438,-42.0195],
  "BA|Guanambi":[-14.2231,-42.7799],
  "CE|Limoeiro do Norte":[-5.1439,-38.0847],
  "MG|Turmalina":[-17.2828,-42.7285],
  "SP|Lindoia":[-22.5226,-46.65],
  "RS|Tres de Maio":[-27.78,-54.2357],
  "SC|Palmitos":[-27.0702,-53.1586],
  "MG|Florestal":[-19.888,-44.4318],
  "SP|Brodowski":[-20.9845,-47.6572],
  "SP|Pauliceia":[-21.3153,-51.8321],
  "SP|Sabino":[-21.4593,-49.5755],
  "MG|Sao Sebastiao do Anta":[-19.5064,-41.985],
  "SP|Miracatu":[-24.2766,-47.4625],
  "RS|Sao Borja":[-28.6578,-56.0036],
  "SP|Gaviao Peixoto":[-21.8367,-48.4957],
  "SC|Xaxim":[-26.9596,-52.5374],
  "SC|Gaspar":[-26.9336,-48.9534],
  "SP|Cardoso":[-20.08,-49.9183],
  "RN|Pau dos Ferros":[-6.105,-38.2077],
  "PE|Orobo":[-7.7455,-35.5956],
  "PI|Barro Duro":[-5.8167,-42.5147],
  "PI|Floriano":[-6.7718,-43.0241],
  "RS|Agudo":[-29.6447,-53.2515],
  "PR|Uniao da Vitoria":[-26.2273,-51.0873],
  "BA|Canavieiras":[-15.6722,-38.9536],
  "MG|Sao Pedro da Uniao":[-21.131,-46.6123],
  "AL|Pilar":[-9.6014,-35.9543],
  "MG|Porto Firme":[-20.6642,-43.0834],
  "RS|Picada Cafe":[-29.4464,-51.1367],
  "MT|Barra do Garcas":[-15.8804,-52.264],
  "RN|Sao Miguel":[-6.2028,-38.4947],
  "RS|Porto Alegre":[-30.0318,-51.2065],
  "SP|Rubineia":[-20.1759,-51.007],
  "BA|Ipiau":[-14.1226,-39.7353],
  "SP|Adamantina":[-21.682,-51.0737],
  "SP|Potirendaba":[-21.0428,-49.3815],
  "PI|Sao Francisco de Assis do Piaui":[-8.236,-41.6873],
  "PR|Agudos do Sul":[-25.9899,-49.3343],
  "SP|Uniao Paulista":[-20.8862,-49.9025],
  "PE|Gloria do Goita":[-8.0057,-35.2904],
  "AL|Pariconha":[-9.2563,-37.9988],
  "PI|Valenca do Piaui":[-6.403,-41.7375],
  "RS|Fontoura Xavier":[-28.9817,-52.3445],
  "MA|Barreirinhas":[-2.7586,-42.8232],
  "SP|Campina do Monte Alegre":[-23.5895,-48.4758],
  "MG|Muzambinho":[-21.3692,-46.5213],
  "MG|Uniao de Minas":[-19.5299,-50.338],
  "AL|Palestina":[-9.6749,-37.339],
  "GO|Goiatuba":[-18.0105,-49.3658],
  "BA|Itatim":[-12.7099,-39.6952],
  "GO|Silvania":[-16.66,-48.6083],
  "MG|Grao Mogol":[-16.5662,-42.8923],
  "RN|Acu":[-5.5836,-36.914],
  "PR|Nova Prata do Iguacu":[-25.6309,-53.3469],
  "MG|Congonhas do Norte":[-18.8021,-43.6767],
  "MA|Barra do Corda":[-5.4968,-45.2485],
  "MG|Itabirito":[-20.2501,-43.8038],
  "CE|Crato":[-7.2153,-39.4103],
  "MG|Pedralva":[-22.2386,-45.4654],
  "GO|Niquelandia":[-14.4662,-48.4599],
  "BA|Serrolandia":[-11.4085,-40.2983],
  "PE|Serrita":[-7.9404,-39.2951],
  "PI|Buriti dos Lopes":[-3.1826,-41.8695],
  "MA|Sao Joao dos Patos":[-6.4934,-43.7036],
  "MG|Entre Folhas":[-19.6218,-42.2306],
  "PR|Terra Roxa":[-24.1575,-54.0988],
  "RJ|Santo Antonio de Padua":[-21.541,-42.1832],
  "SP|Valinhos":[-22.9698,-46.9974],
  "SP|Itobi":[-21.7309,-46.9743],
  "SE|Nossa Senhora do Socorro":[-10.8468,-37.1231],
  "BA|Ibiassuce":[-14.2711,-42.257],
  "AL|Sao Bras":[-10.1141,-36.8522],
  "MG|Esmeraldas":[-19.764,-44.3065],
  "SC|Videira":[-27.0086,-51.1543],
  "BA|Manoel Vitorino":[-14.1476,-40.2399],
  "SP|Taiacu":[-21.1431,-48.5112],
  "MG|Tumiritinga":[-18.9844,-41.6527],
  "RN|Sao Jose de Mipibu":[-6.0773,-35.2417],
  "MG|Ponto dos Volantes":[-16.7473,-41.5025],
  "SC|Botuvera":[-27.2007,-49.0689],
  "SE|Tobias Barreto":[-11.1798,-37.9995],
  "MG|Bocaiuva":[-17.1135,-43.8104],
  "SP|Rifaina":[-20.0803,-47.4291],
  "RS|Morro Reuter":[-29.5379,-51.0811],
  "MA|Santa Rita":[-3.1424,-44.3211],
  "RN|Lagoa de Pedras":[-6.1508,-35.4299],
  "RS|Santo Antonio do Palma":[-28.4956,-52.0267],
  "CE|Jaguaribara":[-5.6776,-38.5359],
  "PE|Brejo da Madre de Deus":[-8.1493,-36.3741],
  "MS|Maracaju":[-21.6105,-55.1678],
  "MG|Araujos":[-19.9405,-45.1671],
  "SP|Poa":[-23.5333,-46.3473],
  "SE|Frei Paulo":[-10.5513,-37.5279],
  "SC|Papanduva":[-26.3777,-50.1419],
  "SP|Narandiba":[-22.4057,-51.5274],
  "BA|Tapiramuta":[-11.8475,-40.7927],
  "PI|Monsenhor Hipolito":[-6.9928,-41.026],
  "BA|Barra do Choca":[-14.8654,-40.5791],
  "RN|Umarizal":[-5.9824,-37.818],
  "RS|Antonio Prado":[-28.8565,-51.2883],
  "PE|Sao Jose da Coroa Grande":[-8.8894,-35.1515],
  "PR|Reserva do Iguacu":[-25.8319,-52.0272],
  "BA|Tanhacu":[-14.0197,-41.2473],
  "PR|Engenheiro Beltrao":[-23.797,-52.2659],
  "RS|Ivoti":[-29.5995,-51.1533],
  "RJ|Arraial do Cabo":[-22.9774,-42.0267],
  "MG|Barra Longa":[-20.2869,-43.0402],
  "SP|Anhembi":[-22.793,-48.1336],
  "RS|Minas do Leao":[-30.1346,-52.0423],
  "BA|Coribe":[-13.8232,-44.4586],
  "MA|Buriticupu":[-4.3238,-46.4409],
  "MG|Presidente Bernardes":[-20.7656,-43.1895],
  "MA|Carutapera":[-1.197,-46.0085],
  "PB|Sousa":[-6.7515,-38.2311],
  "BA|Paramirim":[-13.4388,-42.2395],
  "SP|Louveira":[-23.0856,-46.9484],
  "PR|Cantagalo":[-25.3734,-52.1198],
  "BA|Vitoria da Conquista":[-14.8615,-40.8442],
  "MT|Nova Canaa do Norte":[-10.558,-55.953],
  "SP|Queluz":[-22.5312,-44.7781],
  "SP|Terra Roxa":[-20.787,-48.3314],
  "SP|Sao Luiz do Paraitinga":[-23.222,-45.3109],
  "PR|Corumbatai do Sul":[-24.101,-52.1177],
  "MS|Ladario":[-19.0089,-57.5973],
  "RS|Salvador do Sul":[-29.4386,-51.5077],
  "SP|Macatuba":[-22.5002,-48.7102],
  "SC|Forquilhinha":[-28.7454,-49.4785],
  "SP|Osvaldo Cruz":[-21.7968,-50.8793],
  "SP|Rafard":[-23.0105,-47.5318],
  "SP|Areiopolis":[-22.6672,-48.6681],
  "MG|Mendes Pimentel":[-18.6631,-41.4052],
  "MT|Jangada":[-15.235,-56.4917],
  "SC|Braco do Trombudo":[-27.3586,-49.8821],
  "MG|Rio Pomba":[-21.2712,-43.1696],
  "SC|Florianopolis":[-27.5945,-48.5477],
  "MS|Inocencia":[-19.7277,-51.9281],
  "RJ|Saquarema":[-22.9292,-42.5099],
  "SP|Jaguariuna":[-22.7037,-46.9851],
  "SP|Torre de Pedra":[-23.2462,-48.1955],
  "SP|Tatui":[-23.3487,-47.8461],
  "MT|Juina":[-11.3728,-58.7483],
  "GO|Novo Gama":[-16.0592,-48.0417],
  "SP|Cananeia":[-25.0144,-47.9341],
  "BA|Amargosa":[-13.0215,-39.602],
  "RN|Japi":[-6.4654,-35.9346],
  "BA|Itiuba":[-10.6948,-39.8446],
  "PB|Sobrado":[-7.1443,-35.2357],
  "PR|Sulina":[-25.7066,-52.7299],
  "RN|Rafael Godeiro":[-6.0724,-37.716],
  "PE|Condado":[-7.5879,-35.0999],
  "MG|Bela Vista de Minas":[-19.8302,-43.0922],
  "PI|Sao Goncalo do Piaui":[-5.9939,-42.7095],
  "MG|Sao Vicente de Minas":[-21.7042,-44.4431],
  "PE|Sao Jose do Egito":[-7.4695,-37.274],
  "SP|Itariri":[-24.2834,-47.1736],
  "GO|Morrinhos":[-17.7334,-49.1059],
  "AL|Tanque DArca":[-9.3267,-36.6631],
  "BA|Barro Alto":[-11.7605,-41.9054],
  "MS|Bataypora":[-22.2944,-53.2705],
  "MA|Santa Quiteria do Maranhao":[-3.4931,-42.5688],
  "SP|Jaborandi":[-20.6884,-48.4112],
  "MG|Coluna":[-18.2311,-42.8352],
  "RN|Lagoa Nova":[-6.0934,-36.4703],
  "PB|Itatuba":[-7.3811,-35.638],
  "BA|Serra Dourada":[-12.759,-43.9504],
  "CE|Aratuba":[-4.4123,-39.0471],
  "RS|Cacique Doble":[-27.767,-51.6597],
  "PE|Jupi":[-8.709,-36.4126],
  "PB|Cajazeiras":[-6.88,-38.5577],
  "PE|Altinho":[-8.4848,-36.0644],
  "BA|Wanderley":[-12.1144,-43.8958],
  "RN|Major Sales":[-6.3995,-38.324],
  "PA|Abel Figueiredo":[-4.9533,-48.3933],
  "SP|Palmital":[-22.7858,-50.218],
  "PE|Calumbi":[-7.9355,-38.1482],
  "RO|Candeias do Jamari":[-8.7907,-63.7005],
  "SP|Miguelopolis":[-20.1796,-48.031],
  "BA|Iguai":[-14.7528,-40.0894],
  "MG|Matias Cardoso":[-14.8563,-43.9146],
  "CE|Ararenda":[-4.7457,-40.831],
  "SP|Apiai":[-24.5108,-48.8443],
  "SP|Guapiacu":[-20.7959,-49.2172],
  "RS|Colorado":[-28.5258,-52.9928],
  "MG|Taquaracu de Minas":[-19.6652,-43.6922],
  "BA|Boa Nova":[-14.3598,-40.2064],
  "MG|Mata Verde":[-15.6869,-40.7366],
  "PI|Campo Maior":[-4.8217,-42.1641],
  "RS|Estacao":[-27.9135,-52.2635],
  "MA|Codo":[-4.4556,-43.8924],
  "SE|Campo do Brito":[-10.7392,-37.4954],
  "MS|Selviria":[-20.3637,-51.4192],
  "MG|Nova Lima":[-19.9758,-43.8509],
  "RS|Amaral Ferrador":[-30.8756,-52.2509],
  "RJ|Barra Mansa":[-22.5481,-44.1752],
  "RS|Caraa":[-29.7869,-50.4316],
  "PR|Maringa":[-23.4205,-51.9333],
  "CE|Nova Russas":[-4.7058,-40.5621],
  "MG|Confins":[-19.6282,-43.9931],
  "BA|Casa Nova":[-9.1641,-40.974],
  "SP|Barbosa":[-21.2657,-49.9518],
  "CE|Sao Luis do Curu":[-3.6698,-39.2391],
  "SP|Socorro":[-22.5903,-46.5251],
  "MG|Dionisio":[-19.8433,-42.7701],
  "MA|Maracacume":[-2.0492,-45.9587],
  "MG|Mutum":[-19.8121,-41.4407],
  "SP|Pardinho":[-23.0841,-48.3679],
  "BA|Barra da Estiva":[-13.6237,-41.3347],
  "MA|Passagem Franca":[-6.1775,-43.7755],
  "AL|Piacabucu":[-10.406,-36.434],
  "MG|Itaobim":[-16.5571,-41.5017],
  "RS|Tres Coroas":[-29.5137,-50.7739],
  "SC|Jabora":[-27.1782,-51.7279],
  "MS|Nova Alvorada do Sul":[-21.4657,-54.3825],
  "ES|Itapemirim":[-21.0095,-40.8307],
  "ES|Pedro Canario":[-18.3004,-39.9574],
  "PR|Porto Amazonas":[-25.54,-49.8946],
  "MS|Eldorado":[-23.7868,-54.2838],
  "PR|Nova Alianca do Ivai":[-23.1763,-52.6032],
  "BA|Abaira":[-13.2488,-41.6619],
  "MG|Augusto de Lima":[-18.0997,-44.2655],
  "PR|Marquinho":[-25.112,-52.2497],
  "MG|Teixeiras":[-20.6561,-42.8564],
  "CE|Brejo Santo":[-7.4847,-38.9799],
  "CE|Varzea Alegre":[-6.7826,-39.2942],
  "BA|Elisio Medrado":[-12.9417,-39.5191],
  "SP|Aruja":[-23.3965,-46.32],
  "CE|Barreira":[-4.2892,-38.6429],
  "BA|Itaparica":[-12.8932,-38.68],
  "SE|Itabaiana":[-10.6826,-37.4273],
  "SP|Poloni":[-20.7829,-49.8258],
  "SE|Canhoba":[-10.1365,-36.9806],
  "MG|Fruta de Leite":[-16.1225,-42.5288],
  "GO|Portelandia":[-17.3554,-52.6799],
  "SE|Itabaianinha":[-11.2693,-37.7875],
  "MG|Novo Cruzeiro":[-17.4654,-41.8826],
  "CE|Taua":[-5.9859,-40.2968],
  "BA|Floresta Azul":[-14.8629,-39.6579],
  "SP|Canitar":[-23.004,-49.7839],
  "SP|Jaci":[-20.8805,-49.5797],
  "PR|Lobato":[-23.0058,-51.9524],
  "MG|Leopoldina":[-21.5296,-42.6421],
  "SP|Quata":[-22.2456,-50.6966],
  "AL|Penedo":[-10.2874,-36.5819],
  "BA|Ubata":[-14.2063,-39.5207],
  "BA|Cafarnaum":[-11.6914,-41.4688],
  "PE|Santa Filomena":[-8.1669,-40.6079],
  "BA|Santana":[-12.9792,-44.0506],
  "SP|Itabera":[-23.8638,-49.14],
  "MT|Peixoto de Azevedo":[-10.2262,-54.9794],
  "MG|Belmiro Braga":[-21.944,-43.4084],
  "SC|Timbe do Sul":[-28.8287,-49.842],
  "MA|Sao Mateus do Maranhao":[-4.0374,-44.4707],
  "SC|Campos Novos":[-27.4002,-51.2276],
  "RS|Cruz Alta":[-28.645,-53.6048],
  "PE|Oroco":[-8.6103,-39.6026],
  "BA|Santa Cruz Cabralia":[-16.2825,-39.0295],
  "MG|Itabirinha":[-18.5712,-41.234],
  "MG|Monte Siao":[-22.4335,-46.573],
  "GO|Mambai":[-14.4823,-46.1165],
  "AL|Jacare dos Homens":[-9.6355,-37.2076],
  "SC|Coronel Freitas":[-26.9057,-52.7011],
  "BA|Caetanos":[-14.3347,-40.9175],
  "MG|Chiador":[-21.9996,-43.0617],
  "PR|Guarapuava":[-25.3902,-51.4623],
  "RN|Nisia Floresta":[-6.0933,-35.1991],
  "RS|Trindade do Sul":[-27.5239,-52.8956],
  "PE|Itaiba":[-8.9457,-37.4173],
  "PI|Sao Juliao":[-7.0839,-40.8246],
  "MG|Natercia":[-22.1158,-45.5123],
  "MA|Esperantinopolis":[-4.8794,-44.6926],
  "RJ|Sao Jose do Vale do Rio Preto":[-22.1525,-42.9327],
  "SP|Arealva":[-22.031,-48.9135],
  "SP|Coronel Macedo":[-23.6261,-49.31],
  "BA|Camacari":[-12.6996,-38.3263],
  "SC|Irani":[-27.0287,-51.9012],
  "RS|Encruzilhada do Sul":[-30.543,-52.5204],
  "SP|Santa Cruz das Palmeiras":[-21.8235,-47.248],
  "RJ|Cardoso Moreira":[-21.4846,-41.6165],
  "PE|Bom Jardim":[-7.7969,-35.5784],
  "GO|Amaralina":[-13.9236,-49.2962],
  "SC|Luiz Alves":[-26.7151,-48.9322],
  "BA|Sao Gabriel":[-11.2175,-41.8843],
  "PE|Abreu e Lima":[-7.9007,-34.8984],
  "CE|Altaneira":[-6.9984,-39.7356],
  "SC|Santo Amaro da Imperatriz":[-27.6852,-48.7813],
  "MA|Governador Archer":[-5.0208,-44.2754],
  "PE|Flores":[-7.8584,-37.9715],
  "PR|Sao Joao":[-25.8214,-52.7252],
  "SC|Sao Joao do Sul":[-29.2154,-49.8094],
  "RS|Monte Belo do Sul":[-29.1607,-51.6333],
  "MG|Paraisopolis":[-22.5539,-45.7803],
  "SP|Sao Vicente":[-23.9574,-46.3883],
  "GO|Itaberai":[-16.0206,-49.806],
  "MG|Sao Joao das Missoes":[-14.8859,-44.0922],
  "GO|Santa Rita do Araguaia":[-17.3269,-53.2012],
  "SP|Buri":[-23.7977,-48.5958],
  "SP|Itapura":[-20.6419,-51.5063],
  "MG|Santa Barbara do Tugurio":[-21.2431,-43.5607],
  "SP|Panorama":[-21.354,-51.8562],
  "MT|Nova Mutum":[-13.8374,-56.0743],
  "SC|Laurentino":[-27.2173,-49.7331],
  "SP|Lutecia":[-22.3384,-50.394],
  "RS|Sentinela do Sul":[-30.6107,-51.5862],
  "GO|Sao Simao":[-18.996,-50.547],
  "SP|Pedrinhas Paulista":[-22.8174,-50.7933],
  "PR|Santa Izabel do Oeste":[-25.8217,-53.4801],
  "BA|Milagres":[-12.8646,-39.8611],
  "SP|Santa Branca":[-23.3933,-45.8875],
  "BA|Encruzilhada":[-15.5302,-40.9124],
  "RS|Balneario Pinhal":[-30.2419,-50.2337],
  "BA|Candido Sales":[-15.4993,-41.2414],
  "AL|Rio Largo":[-9.4778,-35.8394],
  "SP|Piracaia":[-23.0525,-46.3594],
  "PB|Cacimbas":[-7.2072,-37.0604],
  "SP|Sao Lourenco da Serra":[-23.8491,-46.9432],
  "PE|Granito":[-7.7071,-39.615],
  "BA|Sao Desiderio":[-12.3572,-44.9769],
  "PB|Nova Palmeira":[-6.6712,-36.422],
  "PI|Marcolandia":[-7.4417,-40.6602],
  "MG|Sao Lourenco":[-22.1166,-45.0506],
  "MG|Engenheiro Navarro":[-17.2831,-43.947],
  "BA|Ubaira":[-13.2714,-39.666],
  "ES|Santa Maria de Jetiba":[-20.0253,-40.7439],
  "ES|Ecoporanga":[-18.3702,-40.836],
  "PR|Tapejara":[-23.7315,-52.8735],
  "BA|Correntina":[-13.3477,-44.6333],
  "MG|Ponte Nova":[-20.4111,-42.8978],
  "MG|Estiva":[-22.4577,-46.0191],
  "SP|Olimpia":[-20.7366,-48.9106],
  "MG|Sao Joao do Oriente":[-19.3384,-42.1575],
  "PE|Nazare da Mata":[-7.7415,-35.2193],
  "RS|Terra de Areia":[-29.5782,-50.0644],
  "MT|Campo Novo do Parecis":[-13.6587,-57.8907],
  "PI|Caldeirao Grande do Piaui":[-7.3314,-40.6366],
  "RS|Ernestina":[-28.4977,-52.5836],
  "PR|Mandirituba":[-25.777,-49.3282],
  "CE|Parambu":[-6.2077,-40.6905],
  "SP|Maua":[-23.6677,-46.4613],
  "SP|Igaracu do Tiete":[-22.509,-48.5597],
  "BA|Lajedinho":[-12.3529,-40.9048],
  "MT|Caceres":[-16.0764,-57.6818],
  "MA|Sao Joao do Caru":[-3.5503,-46.2507],
  "CE|Morada Nova":[-5.0974,-38.3702],
  "BA|Piritiba":[-11.73,-40.5587],
  "MA|Itinga do Maranhao":[-4.4529,-47.5235],
  "PB|Rio Tinto":[-6.8038,-35.0776],
  "PI|Simoes":[-7.5911,-40.8137],
  "MG|Santa Rita de Jacutinga":[-22.1474,-44.0977],
  "ES|Montanha":[-18.1303,-40.3668],
  "RS|Tabai":[-29.643,-51.6823],
  "PE|Carpina":[-7.8457,-35.2514],
  "CE|Carire":[-3.9486,-40.476],
  "PB|Santa Rita":[-7.1172,-34.9753],
  "PA|Garrafao do Norte":[-1.9299,-47.0505],
  "SC|Balneario Arroio do Silva":[-28.9806,-49.4237],
  "PB|Aracagi":[-6.8437,-35.3737],
  "RS|Gravatai":[-29.9413,-50.9869],
  "MG|Areado":[-21.3572,-46.1421],
  "RN|Sao Goncalo do Amarante":[-5.7907,-35.3257],
  "SP|Cerqueira Cesar":[-23.038,-49.1655],
  "BA|Lafaiete Coutinho":[-13.6541,-40.2119],
  "BA|Ponto Novo":[-10.8653,-40.1311],
  "MG|Sao Joao da Ponte":[-15.9271,-44.0096],
  "PE|Panelas":[-8.6612,-36.0125],
  "SC|Governador Celso Ramos":[-27.3172,-48.5576],
  "RS|Lindolfo Collor":[-29.5859,-51.2141],
  "RN|Extremoz":[-5.7014,-35.3048],
  "SP|Nova Europa":[-21.7765,-48.5705],
  "PA|Tome Acu":[-2.4181,-48.1506],
  "ES|Conceicao do Castelo":[-20.3639,-41.2417],
  "BA|Jiquirica":[-13.2621,-39.5737],
  "SP|Laranjal Paulista":[-23.0506,-47.8375],
  "BA|Maracas":[-13.4355,-40.4323],
  "BA|Cruz das Almas":[-12.6675,-39.1008],
  "SP|Pedranopolis":[-20.2474,-50.1129],
  "GO|agua Limpa":[-18.0771,-48.7603],
  "MG|Senador Amaral":[-22.5869,-46.1763],
  "ES|Sao Gabriel da Palha":[-19.0182,-40.5365],
  "BA|Ibotirama":[-12.1779,-43.2167],
  "MG|Luz":[-19.7911,-45.6794],
  "PE|Gravata":[-8.2112,-35.5675],
  "SP|Cedral":[-20.9009,-49.2664],
  "SP|Itupeva":[-23.1526,-47.0593],
  "SP|Jundiai":[-23.1852,-46.8974],
  "SC|Passos Maia":[-26.7829,-52.0568],
  "SP|Pirangi":[-21.0886,-48.6607],
  "RS|Formigueiro":[-30.0035,-53.4959],
  "RJ|Sao Goncalo":[-22.8268,-43.0634],
  "MG|Brazopolis":[-22.4743,-45.6166],
  "BA|Prado":[-17.3364,-39.2227],
  "MT|Lucas do Rio Verde":[-13.0588,-55.9042],
  "CE|Aquiraz":[-3.8993,-38.3896],
  "MG|Sao Geraldo":[-20.9252,-42.8364],
  "SP|Americana":[-22.7374,-47.3331],
  "SP|Maracai":[-22.6149,-50.6713],
  "MS|Ivinhema":[-22.3046,-53.8184],
  "RN|Tibau do Sul":[-6.1918,-35.0866],
  "GO|Aragoiania":[-16.9087,-49.4476],
  "SC|Santa Cecilia":[-26.9592,-50.4252],
  "SC|Balneario Rincao":[-28.8314,-49.2352],
  "CE|Pacajus":[-4.1711,-38.465],
  "AL|Vicosa":[-9.3676,-36.2431],
  "MG|Serro":[-18.5991,-43.3744],
  "MG|Eloi Mendes":[-21.6088,-45.5691],
  "BA|Santo Amaro":[-12.5472,-38.7137],
  "BA|Castro Alves":[-12.7579,-39.4248],
  "MG|Sao Goncalo do Abaete":[-18.3315,-45.8265],
  "MG|Rio Pardo de Minas":[-15.616,-42.5405],
  "SP|Candido Mota":[-22.7471,-50.3873],
  "MG|Galileia":[-19.0005,-41.5387],
  "PB|Picui":[-6.5084,-36.3497],
  "PI|Francisco Ayres":[-6.6261,-42.6881],
  "MG|Nanuque":[-17.8481,-40.3533],
  "MG|Presidente Olegario":[-18.4096,-46.4165],
  "MS|Itaquirai":[-23.4779,-54.187],
  "SC|Taio":[-27.121,-49.9942],
  "SP|Tarabai":[-22.3016,-51.5621],
  "MG|Visconde do Rio Branco":[-21.0127,-42.8361],
  "SP|Clementina":[-21.5604,-50.4525],
  "GO|Palminopolis":[-16.7924,-50.1652],
  "MA|Mirinzal":[-2.0709,-44.7787],
  "PE|Sirinhaem":[-8.5878,-35.1126],
  "PB|Queimadas":[-7.3503,-35.9031],
  "MS|Amambai":[-23.1058,-55.2253],
  "SP|Buritizal":[-20.1911,-47.7096],
  "PE|Ingazeira":[-7.6691,-37.4576],
  "MG|Diamantina":[-18.2413,-43.6031],
  "PR|Renascenca":[-26.1588,-52.9703],
  "MG|Mathias Lobato":[-18.59,-41.9166],
  "BA|Buerarema":[-14.9595,-39.3028],
  "RN|Carnaubais":[-5.3418,-36.8335],
  "MG|Toledo":[-22.7421,-46.3728],
  "MG|Planura":[-20.1376,-48.7],
  "CE|Farias Brito":[-6.9215,-39.5651],
  "MG|Conceicao das Pedras":[-22.1576,-45.4562],
  "SP|Teodoro Sampaio":[-22.5299,-52.1682],
  "PA|Altamira":[-3.2041,-52.21],
  "RS|Santo Cristo":[-27.8263,-54.662],
  "PR|Jundiai do Sul":[-23.4357,-50.2496],
  "SP|Rancharia":[-22.2269,-50.893],
  "PR|Palotina":[-24.2868,-53.8404],
  "RS|Ibiaca":[-28.0566,-51.8599],
  "MA|Tuntum":[-5.2548,-44.6444],
  "MG|Limeira do Oeste":[-19.5512,-50.5815],
  "MG|Bom Repouso":[-22.4675,-46.144],
  "PE|Agrestina":[-8.4597,-35.9447],
  "MG|Santo Antonio do Monte":[-20.085,-45.2947],
  "MG|Dona Euzebia":[-21.1833,-42.9667],
  "BA|Buritirama":[-10.7171,-43.6302],
  "MG|Tiros":[-19.0037,-45.9626],
  "PR|Santo Inacio":[-22.6957,-51.7969],
  "CE|Beberibe":[-4.1774,-38.1271],
  "PE|Dormentes":[-8.4412,-40.7662],
  "PR|Cascavel":[-24.9573,-53.459],
  "MG|Tarumirim":[-19.2835,-42.0097],
  "PR|Andira":[-23.0533,-50.2304],
  "PR|Presidente Castelo Branco":[-23.2782,-52.1536],
  "PR|Boa Vista da Aparecida":[-25.4308,-53.4117],
  "MG|Santa Rita do Sapucai":[-22.2461,-45.7034],
  "PB|Sao Vicente do Serido":[-6.8543,-36.4122],
  "RS|Tucunduva":[-27.6573,-54.4439],
  "AL|Olho Dagua das Flores":[-9.5333,-37.3],
  "MG|Passabem":[-19.3509,-43.1383],
  "RS|Chapada":[-28.0559,-53.0665],
  "PE|Lajedo":[-8.6579,-36.3293],
  "PR|Altamira do Parana":[-24.7983,-52.7128],
  "PR|Godoy Moreira":[-24.173,-51.9246],
  "SP|Santa Maria da Serra":[-22.5661,-48.1593],
  "GO|Amorinopolis":[-16.6151,-51.0919],
  "MA|Chapadinha":[-3.7388,-43.3538],
  "BA|Riachao das Neves":[-11.7508,-44.9143],
  "PB|Princesa Isabel":[-7.7317,-37.9886],
  "RS|Pantano Grande":[-30.1902,-52.3729],
  "AL|Capela":[-9.415,-36.0826],
  "SP|Jacarei":[-23.2983,-45.9658],
  "PB|Catole do Rocha":[-6.3406,-37.747],
  "SP|aguas de Lindoia":[-22.4733,-46.6314],
  "RS|Guarani das Missoes":[-28.1491,-54.5629],
  "RS|Sananduva":[-27.947,-51.8079],
  "SC|Balneario Barra do Sul":[-26.4597,-48.6123],
  "SP|Luis Antonio":[-21.55,-47.7801],
  "MT|Sapezal":[-12.9892,-58.7645],
  "MG|Rio Piracicaba":[-19.9284,-43.1829],
  "MS|Iguatemi":[-23.6736,-54.5637],
  "MA|Sao Raimundo das Mangabeiras":[-7.0218,-45.4809],
  "PR|Iretama":[-24.4253,-52.1012],
  "MG|Cachoeira de Minas":[-22.3511,-45.7809],
  "GO|Vicentinopolis":[-17.7322,-49.8047],
  "SP|Estrela DOeste":[-20.2833,-50.85],
  "GO|Indiara":[-17.1387,-49.9862],
  "GO|Quirinopolis":[-18.4472,-50.4547],
  "RJ|Petropolis":[-22.52,-43.1926],
  "SP|Quintana":[-22.0692,-50.307],
  "RS|Dom Pedro de Alcantara":[-29.3639,-49.853],
  "PE|Tamandare":[-8.7567,-35.1033],
  "MG|Vargem Alegre":[-19.5988,-42.2949],
  "RN|Santa Cruz":[-6.2248,-36.0193],
  "BA|Jitauna":[-14.0131,-39.8969],
  "PR|Rio Branco do Sul":[-25.1892,-49.3115],
  "SP|Indiapora":[-19.979,-50.2909],
  "BA|Pirai do Norte":[-13.759,-39.3836],
  "SP|Taiuva":[-21.1223,-48.4528],
  "PR|Santa Amelia":[-23.2654,-50.4288],
  "PR|Querencia do Norte":[-23.0838,-53.483],
  "CE|Potengi":[-7.0915,-40.0233],
  "PR|Capanema":[-25.6691,-53.8055],
  "SC|Nova Trento":[-27.278,-48.9298],
  "RS|Mostardas":[-31.1054,-50.9167],
  "SP|Murutinga do Sul":[-20.9908,-51.2774],
  "RS|Vale Real":[-29.3919,-51.2559],
  "MS|Brasilandia":[-21.2544,-52.0365],
  "PR|Carlopolis":[-23.4269,-49.7235],
  "RJ|Bom Jesus do Itabapoana":[-21.1449,-41.6822],
  "SP|Sandovalina":[-22.4551,-51.7648],
  "SE|Carira":[-10.3524,-37.7002],
  "RS|Santo Antonio das Missoes":[-28.514,-55.2251],
  "RJ|Duque de Caxias":[-22.7858,-43.3049],
  "GO|Goias":[-15.9333,-50.14],
  "SP|Cruzalia":[-22.7373,-50.7909],
  "MA|Goncalves Dias":[-5.1475,-44.3013],
  "SP|Nova Independencia":[-21.1026,-51.4905],
  "PA|Tailandia":[-2.9458,-48.9489],
  "CE|Itarema":[-2.9248,-39.9167],
  "SP|Ribeirao Branco":[-24.2206,-48.7635],
  "MG|Moema":[-19.8387,-45.4127],
  "RS|Espumoso":[-28.7286,-52.8461],
  "SP|Itatinga":[-23.1047,-48.6157],
  "MG|Borda da Mata":[-22.2707,-46.1653],
  "GO|Goiania":[-16.6864,-49.2643],
  "MG|Nova Serrana":[-19.8713,-44.9847],
  "MG|Pote":[-17.8077,-41.786],
  "SP|Salto de Pirapora":[-23.6474,-47.5743],
  "MA|Santa Ines":[-3.6511,-45.3774],
  "GO|Campinorte":[-14.3137,-49.1511],
  "SP|Pitangueiras":[-21.0132,-48.221],
  "CE|Oros":[-6.2518,-38.9053],
  "BA|Formosa do Rio Preto":[-11.0328,-45.193],
  "MG|Sao Geraldo da Piedade":[-18.8411,-42.2867],
  "BA|Terra Nova":[-12.3888,-38.6238],
  "GO|Pirenopolis":[-15.8507,-48.9584],
  "SP|Casa Branca":[-21.7708,-47.0852],
  "PI|Marcos Parente":[-7.1156,-43.8926],
  "BA|Catu":[-12.3513,-38.3791],
  "SP|Pariquera Acu":[-24.7167,-47.8833],
  "MG|Barbacena":[-21.2214,-43.7703],
  "PR|Perola dOeste":[-25.7833,-53.75],
  "BA|Souto Soares":[-12.088,-41.6427],
  "MT|Pedra Preta":[-16.6245,-54.4722],
  "MT|Matupa":[-10.1821,-54.9467],
  "ES|Alegre":[-20.758,-41.5382],
  "SE|Capela":[-10.5069,-37.0628],
  "RN|Currais Novos":[-6.2548,-36.5146],
  "RS|Candiota":[-31.5516,-53.6773],
  "MG|Setubinha":[-17.6002,-42.1587],
  "PI|Sao Felix do Piaui":[-5.9348,-42.1172],
  "PR|Cruzeiro do Oeste":[-23.7799,-53.0774],
  "SP|Redencao da Serra":[-23.2638,-45.5422],
  "MG|Sao Francisco":[-15.9514,-44.8593],
  "PR|Palmeira":[-25.4257,-50.007],
  "SP|Natividade da Serra":[-23.3707,-45.4468],
  "SP|Peruibe":[-24.312,-47.0012],
  "SP|Sao Jose da Bela Vista":[-20.5935,-47.6424],
  "PB|Belem do Brejo do Cruz":[-6.1852,-37.5348],
  "ES|Piuma":[-20.8334,-40.7268],
  "MT|Sao Jose do Xingu":[-10.7982,-52.7486],
  "MG|Curvelo":[-18.7527,-44.4303],
  "MG|Tres Marias":[-18.2048,-45.2473],
  "RS|Cruzeiro do Sul":[-29.5148,-51.9928],
  "RS|Santo Antonio da Patrulha":[-29.8268,-50.5175],
  "CE|Carnaubal":[-4.1598,-40.9413],
  "PR|Sertanopolis":[-23.0571,-51.0399],
  "SP|Piratininga":[-22.4142,-49.1339],
  "GO|Uruacu":[-14.5238,-49.1396],
  "SP|Manduri":[-23.0056,-49.3202],
  "RS|Canoas":[-29.9128,-51.1857],
  "PE|Triunfo":[-7.8327,-38.0978],
  "PI|Luis Correia":[-2.8844,-41.6641],
  "MT|Confresa":[-10.6437,-51.5699],
  "SP|Vargem Grande do Sul":[-21.8322,-46.8913],
  "GO|Caldas Novas":[-17.7441,-48.6246],
  "AL|Mata Grande":[-9.1182,-37.7323],
  "RS|Jacutinga":[-27.7291,-52.5372],
  "RS|Taquari":[-29.7943,-51.8653],
  "MG|Juruaia":[-21.2493,-46.5735],
  "RS|Manoel Viana":[-29.5859,-55.4841],
  "CE|Barroquinha":[-3.0205,-41.1358],
  "MG|Almenara":[-16.1785,-40.6942],
  "SP|Borebi":[-22.5728,-48.9707],
  "RN|Brejinho":[-6.1857,-35.3591],
  "RN|Serra do Mel":[-5.1772,-37.0242],
  "RS|Sao Jose do Hortencio":[-29.528,-51.245],
  "RS|Sarandi":[-27.942,-52.9231],
  "RS|Getulio Vargas":[-27.8911,-52.2294],
  "PR|Dois Vizinhos":[-25.7407,-53.057],
  "BA|Xique Xique":[-10.8236,-42.7275],
  "SC|Monte Castelo":[-26.461,-50.2327],
  "GO|Anicuns":[-16.4642,-49.9617],
  "PR|Sao Pedro do Iguacu":[-24.9373,-53.8521],
  "CE|Cascavel":[-4.1297,-38.2412],
  "ES|Aracruz":[-19.82,-40.2764],
  "SP|Populina":[-19.9453,-50.538],
  "MG|Santana do Riacho":[-19.1662,-43.722],
  "SC|Fraiburgo":[-27.0233,-50.92],
  "MA|Sao Pedro da agua Branca":[-5.0847,-48.4291],
  "SP|Boraceia":[-22.1926,-48.7808],
  "MG|Capitolio":[-20.6164,-46.0493],
  "MG|Franciscopolis":[-17.9578,-42.0094],
  "MG|Guanhaes":[-18.7713,-42.9312],
  "BA|Aracas":[-12.22,-38.2027],
  "SC|Agronomica":[-27.2662,-49.708],
  "SC|Descanso":[-26.827,-53.5034],
  "RS|Santo Augusto":[-27.8526,-53.7776],
  "RS|Gentil":[-28.4316,-52.0337],
  "PI|Brasileira":[-4.1337,-41.7859],
  "MG|Rio Vermelho":[-18.2922,-43.0018],
  "PR|Sertaneja":[-23.0361,-50.8317],
  "PR|Itambe":[-23.6601,-51.9912],
  "GO|Mineiros":[-17.5654,-52.5537],
  "PR|Nova Aurora":[-24.5289,-53.2575],
  "GO|Nova Iguacu de Goias":[-14.2868,-49.3872],
  "MG|Bambui":[-20.0166,-45.9754],
  "SE|Aquidaba":[-10.278,-37.0148],
  "MG|Sao Joao do Paraiso":[-15.3168,-42.0213],
  "SP|Valparaiso":[-21.2229,-50.8699],
  "RS|Carlos Barbosa":[-29.2969,-51.5028],
  "RN|Nova Cruz":[-6.4751,-35.4286],
  "PR|Santa Mariana":[-23.1465,-50.5167],
  "SP|Monte Castelo":[-21.2981,-51.5679],
  "SP|Castilho":[-20.8689,-51.4884],
  "CE|Boa Viagem":[-5.1126,-39.7337],
  "MG|Iturama":[-19.7276,-50.1966],
  "MG|Cabeceira Grande":[-16.0335,-47.0862],
  "BA|Boa Vista do Tupim":[-12.6498,-40.6064],
  "ES|Barra de Sao Francisco":[-18.7548,-40.8965],
  "RS|Sao Joao do Polesine":[-29.6194,-53.4439],
  "RS|Garibaldi":[-29.259,-51.5352],
  "PE|Arcoverde":[-8.4152,-37.0577],
  "GO|Porangatu":[-13.4391,-49.1503],
  "BA|Ibicui":[-14.845,-39.9879],
  "PR|Candoi":[-25.5758,-52.0409],
  "SP|Maraba Paulista":[-22.1068,-51.9617],
  "SP|Sagres":[-21.8823,-50.9594],
  "MG|Santo Antonio do Aventureiro":[-21.7606,-42.8115],
  "PI|Corrente":[-10.4333,-45.1633],
  "RJ|Campos dos Goytacazes":[-21.7622,-41.3181],
  "MG|Felicio dos Santos":[-18.0755,-43.2422],
  "MG|Baldim":[-19.2832,-43.9613],
  "PR|Colorado":[-22.8374,-51.9743],
  "PE|Alagoinha":[-8.4665,-36.7788],
  "SP|Pinhalzinho":[-22.7811,-46.5897],
  "SP|Iaras":[-22.8682,-49.1634],
  "MA|Lago da Pedra":[-4.5697,-45.1319],
  "MG|Alterosa":[-21.2488,-46.1387],
  "MS|Navirai":[-23.0618,-54.1995],
  "SP|Sao Bernardo do Campo":[-23.6914,-46.5646],
  "GO|Bonopolis":[-13.6329,-49.8106],
  "MG|Paiva":[-21.2913,-43.4088],
  "SE|Japoata":[-10.3477,-36.8045],
  "ES|Iuna":[-20.3531,-41.5334],
  "MG|Carmo do Rio Claro":[-20.9736,-46.1149],
  "GO|Padre Bernardo":[-15.1605,-48.2833],
  "PI|Lagoa do Barro do Piaui":[-8.4767,-41.5342],
  "MG|Sao Domingos do Prata":[-19.8678,-42.971],
  "PR|Jaguapita":[-23.1104,-51.5342],
  "MT|Ribeirao Cascalheira":[-12.9367,-51.8244],
  "SC|Rio do Sul":[-27.2156,-49.643],
  "MS|Sidrolandia":[-20.9302,-54.9692],
  "RS|Santa Clara do Sul":[-29.4747,-52.0843],
  "GO|Rubiataba":[-15.1617,-49.8048],
  "BA|Itapebi":[-15.9551,-39.5329],
  "BA|Palmas de Monte Alto":[-14.2676,-43.1609],
  "MG|Itaguara":[-20.3947,-44.4875],
  "SE|Brejo Grande":[-10.4297,-36.4611],
  "SP|Cabralia Paulista":[-22.4576,-49.3393],
  "RN|Jucurutu":[-6.0306,-37.009],
  "CE|Aracati":[-4.5583,-37.7679],
  "SP|Nova Granada":[-20.5321,-49.3123],
  "SP|Sao Joao de Iracema":[-20.5111,-50.3561],
  "SC|Sao Joao Batista":[-27.2772,-48.8474],
  "MG|Bom Sucesso":[-21.0329,-44.7537],
  "SP|Restinga":[-20.6056,-47.4833],
  "RN|Upanema":[-5.6376,-37.2635],
  "PB|Aroeiras":[-7.5447,-35.7066],
  "RS|Pejucara":[-28.4283,-53.6579],
  "SP|Patrocinio Paulista":[-20.6384,-47.2801],
  "AL|Palmeira dos indios":[-9.4057,-36.6328],
  "SC|Ibiam":[-27.1847,-51.2352],
  "SC|Morro da Fumaca":[-28.6511,-49.2169],
  "PB|Sao Joao do Rio do Peixe":[-6.7219,-38.4468],
  "PR|Mangueirinha":[-25.9421,-52.1743],
  "CE|Forquilha":[-3.7995,-40.2634],
  "SC|Ilhota":[-26.9023,-48.8251],
  "SC|Bom Retiro":[-27.799,-49.487],
  "PR|Iguaracu":[-23.1949,-51.8256],
  "MA|Santa Luzia":[-4.0687,-45.69],
  "BA|Itanhem":[-17.1642,-40.3321],
  "MG|Itanhomi":[-19.1736,-41.863],
  "DF|Brasilia":[-15.7795,-47.9297],
  "RN|Pendencias":[-5.2564,-36.7095],
  "MG|Santana do Jacare":[-20.9007,-45.1285],
  "MG|Sao Pedro do Suacui":[-18.3609,-42.5981],
  "SP|Tapiratiba":[-21.4713,-46.7448],
  "AL|Sao Sebastiao":[-9.9304,-36.559],
  "MG|Carangola":[-20.7343,-42.0313],
  "SC|Passo de Torres":[-29.3099,-49.722],
  "MG|Divisa Nova":[-21.5092,-46.1904],
  "SP|Guaranta":[-21.8942,-49.5914],
  "RN|Caico":[-6.4544,-37.1067],
  "RJ|Nova Iguacu":[-22.7556,-43.4603],
  "BA|Jaborandi":[-13.6071,-44.4255],
  "SE|Neopolis":[-10.3215,-36.585],
  "MG|Buritizeiro":[-17.3656,-44.9606],
  "PI|Alagoinha do Piaui":[-7.0004,-40.9282],
  "MG|Camanducaia":[-22.7515,-46.1494],
  "PR|Uniflor":[-23.0868,-52.1573],
  "SP|Sorocaba":[-23.4969,-47.4451],
  "PE|Solidao":[-7.5947,-37.6445],
  "BA|Utinga":[-12.0783,-41.0954],
  "SP|Rio Claro":[-22.3984,-47.5546],
  "BA|Ubaitaba":[-14.303,-39.3222],
  "BA|Nilo Pecanha":[-13.604,-39.1091],
  "MG|Coromandel":[-18.4734,-47.1933],
  "RS|Sobradinho":[-29.4194,-53.0326],
  "SP|Aramina":[-20.0882,-47.7873],
  "MG|Conceicao do Para":[-19.7456,-44.8945],
  "MG|Chapada do Norte":[-17.0881,-42.5392],
  "MT|Nova Bandeirantes":[-9.8498,-57.8139],
  "SP|Altinopolis":[-21.0214,-47.3712],
  "PE|Itapissuma":[-7.768,-34.8971],
  "SP|Cosmorama":[-20.4755,-49.7827],
  "BA|Jaguaquara":[-13.5248,-39.964],
  "GO|Montividiu":[-17.4439,-51.1728],
  "MG|Ouro Fino":[-22.2779,-46.3716],
  "GO|Trombas":[-13.5079,-48.7417],
  "MG|Jordania":[-15.9009,-40.1841],
  "MG|Itacambira":[-17.0625,-43.3069],
  "MA|Duque Bacelar":[-4.15,-42.9477],
  "MG|Nazareno":[-21.2168,-44.6138],
  "RN|Sitio Novo":[-6.1113,-35.909],
  "SP|Piacatu":[-21.5921,-50.6003],
  "MG|Marilac":[-18.5079,-42.0822],
  "BA|Itamaraju":[-17.0378,-39.5386],
  "MG|Juvenilia":[-14.2662,-44.1597],
  "RS|Capivari do Sul":[-30.1383,-50.5152],
  "MG|Inconfidentes":[-22.3136,-46.3264],
  "MG|Conceicao do Mato Dentro":[-19.0344,-43.4221],
  "MG|Matias Barbosa":[-21.869,-43.3135],
  "MG|Tres Pontas":[-21.3694,-45.5109],
  "RS|Entre Ijuis":[-28.3686,-54.2686],
  "BA|Camamu":[-13.9398,-39.1071],
  "RS|Teutonia":[-29.4482,-51.8044],
  "PE|Lagoa do Ouro":[-9.1257,-36.4584],
  "MA|Benedito Leite":[-7.2104,-44.5577],
  "BA|Pedro Alexandre":[-10.012,-37.8932],
  "RS|Frederico Westphalen":[-27.3586,-53.3958],
  "SC|Palhoca":[-27.6455,-48.6697],
  "SC|Capinzal":[-27.3473,-51.6057],
  "SP|Dumont":[-21.2324,-47.9756],
  "SP|Itirapua":[-20.6416,-47.2194],
  "CE|Cruz":[-2.9181,-40.176],
  "MG|Crisolita":[-17.2381,-40.9184],
  "MG|Bonfinopolis de Minas":[-16.568,-45.9839],
  "GO|Bela Vista de Goias":[-16.9693,-48.9513],
  "ES|aguia Branca":[-18.9846,-40.7437],
  "PB|Condado":[-6.8983,-37.606],
  "RN|Touros":[-5.2018,-35.4621],
  "PB|Paulista":[-6.5914,-37.6185],
  "SP|Pereiras":[-23.0804,-47.972],
  "SC|Herval DOeste":[-27.1903,-51.4917],
  "BA|Rio do Antonio":[-14.4071,-42.0721],
  "MG|Uberlandia":[-18.9141,-48.2749],
  "PB|Mamanguape":[-6.8337,-35.1213],
  "SP|Itapecerica da Serra":[-23.7161,-46.8572],
  "PR|Manoel Ribas":[-24.5144,-51.6658],
  "BA|Macaubas":[-13.0186,-42.6945],
  "RS|Lagoa Bonita do Sul":[-29.4939,-53.017],
  "RS|Cruzaltense":[-27.6672,-52.6522],
  "BA|Lagoa Real":[-14.0334,-42.1328],
  "PB|Alagoa Grande":[-7.0394,-35.6206],
  "BA|erico Cardoso":[-13.4215,-42.1352],
  "RN|Jardim do Serido":[-6.5805,-36.7736],
  "PR|Figueira":[-23.8455,-50.4031],
  "RS|Palmeira das Missoes":[-27.9007,-53.3134],
  "PE|Bodoco":[-7.7776,-39.9338],
  "RN|Tenente Ananias":[-6.4582,-38.182],
  "MA|Pedreiras":[-4.5648,-44.6006],
  "MG|Rodeiro":[-21.2035,-42.8586],
  "BA|Curaca":[-8.9846,-39.8997],
  "BA|Aurelino Leal":[-14.321,-39.329],
  "SP|Osasco":[-23.5324,-46.7916],
  "MG|Frei Inocencio":[-18.5556,-41.9121],
  "SC|Treviso":[-28.5097,-49.4634],
  "RS|Farroupilha":[-29.2227,-51.3419],
  "MG|Descoberto":[-21.46,-42.9618],
  "RJ|Cantagalo":[-21.9797,-42.3664],
  "PB|Itaporanga":[-7.302,-38.1504],
  "PR|Ipora":[-24.0083,-53.706],
  "BA|Sobradinho":[-9.4502,-40.8145],
  "SP|Sao Pedro do Turvo":[-22.7453,-49.7428],
  "MG|Alto Rio Doce":[-21.0281,-43.4067],
  "SP|Borborema":[-21.6214,-49.0741],
  "MG|Queluzito":[-20.7416,-43.8851],
  "BA|Ibiquera":[-12.6444,-40.9338],
  "MG|Dores do Indaia":[-19.4628,-45.5927],
  "RJ|Sao Francisco de Itabapoana":[-21.4702,-41.1091],
  "MS|Pedro Gomes":[-18.0996,-54.5507],
  "PR|Marilandia do Sul":[-23.7425,-51.3137],
  "SE|Sao Domingos":[-10.7916,-37.5685],
  "PE|Alianca":[-7.604,-35.2227],
  "MT|Santa Cruz do Xingu":[-10.1532,-52.3953],
  "PR|Nova Tebas":[-24.438,-51.9454],
  "BA|Nordestina":[-10.8192,-39.4297],
  "AL|Ouro Branco":[-9.1588,-37.3556],
  "MG|Lambari":[-21.9671,-45.3498],
  "SC|Jacinto Machado":[-28.9961,-49.7623],
  "GO|Aragarcas":[-15.8955,-52.2372],
  "CE|Independencia":[-5.3879,-40.3085],
  "SP|Avanhandava":[-21.4584,-49.9509],
  "SC|Sideropolis":[-28.5955,-49.4314],
  "SP|Vitoria Brasil":[-20.1956,-50.4875],
  "MG|Fama":[-21.4089,-45.8286],
  "PE|Moreno":[-8.1087,-35.0835],
  "MG|Divinolandia de Minas":[-18.8004,-42.6103],
  "RS|David Canabarro":[-28.3849,-51.8482],
  "RS|Dom Pedrito":[-30.9756,-54.6694],
  "RS|Nonoai":[-27.3689,-52.7756],
  "PR|Guaratuba":[-25.8817,-48.5752],
  "RN|Apodi":[-5.6535,-37.7946],
  "PR|Turvo":[-25.0437,-51.5282],
  "RN|Venha Ver":[-6.3202,-38.4896],
  "SC|Sao Jose":[-27.6136,-48.6366],
  "PE|Sao Vicente Ferrer":[-7.5897,-35.4808],
  "MG|Guaraciaba":[-20.5716,-43.0094],
  "CE|Tururu":[-3.5841,-39.4297],
  "BA|Alcobaca":[-17.5195,-39.2036],
  "PR|Porto Rico":[-22.7747,-53.2677],
  "SC|Barra Velha":[-26.637,-48.6933],
  "MS|Rio Verde de Mato Grosso":[-18.9249,-54.8434],
  "MG|Patos de Minas":[-18.5699,-46.5013],
  "SP|Torrinha":[-22.4237,-48.1731],
  "SP|Promissao":[-21.5356,-49.8599],
  "MT|Acorizal":[-15.194,-56.3632],
  "PA|Tucurui":[-3.7657,-49.6773],
  "MG|Claudio":[-20.4437,-44.7673],
  "MA|Sao Domingos do Maranhao":[-5.5809,-44.3822],
  "PR|Fenix":[-23.9135,-51.9805],
  "MA|Urbano Santos":[-3.2064,-43.3878],
  "MT|Itiquira":[-17.2147,-54.1422],
  "RS|Encantado":[-29.2351,-51.8703],
  "RJ|Conceicao de Macabu":[-22.0834,-41.8719],
  "MG|Unai":[-16.3592,-46.9022],
  "GO|Barro Alto":[-14.9658,-48.9086],
  "MG|Vazante":[-17.9827,-46.9088],
  "SP|Barra do Chapeu":[-24.4722,-49.0238],
  "MG|Cantagalo":[-18.5248,-42.6223],
  "MG|Aimores":[-19.5007,-41.0746],
  "RJ|Rio das Ostras":[-22.5174,-41.9475],
  "MS|Aparecida do Taboado":[-20.0873,-51.0961],
  "BA|Coronel Joao Sa":[-10.2847,-37.9198],
  "MG|Dom Cavati":[-19.3735,-42.1121],
  "BA|Cocos":[-14.1814,-44.5352],
  "MG|Sao Jose do Alegre":[-22.3243,-45.5258],
  "PI|Santo Antonio de Lisboa":[-6.9868,-41.2252],
  "AL|Boca da Mata":[-9.6431,-36.2125],
  "RN|Lajes Pintadas":[-6.1494,-36.1171],
  "SP|Lucelia":[-21.7182,-51.0215],
  "SP|Sud Mennucci":[-20.6872,-50.9238],
  "RS|Sao Lourenco do Sul":[-31.3564,-51.9715],
  "BA|Maiquinique":[-15.624,-40.2587],
  "MT|Colider":[-10.8135,-55.461],
  "SP|Marilia":[-22.2171,-49.9501],
  "SP|Dois Corregos":[-22.3673,-48.3819],
  "GO|Jandaia":[-17.0481,-50.1453],
  "AL|Campo Alegre":[-9.7845,-36.3525],
  "RS|Vera Cruz":[-29.7184,-52.5152],
  "MG|Tabuleiro":[-21.3632,-43.2381],
  "MG|Alem Paraiba":[-21.8797,-42.7176],
  "SP|Iacri":[-21.8572,-50.6932],
  "PR|Ampere":[-25.9168,-53.4686],
  "PR|Marumbi":[-23.7058,-51.6404],
  "CE|Camocim":[-2.9005,-40.8544],
  "PE|Tabira":[-7.5837,-37.5377],
  "PR|Porecatu":[-22.7537,-51.3795],
  "MT|Juara":[-11.2639,-57.5244],
  "PR|Campina da Lagoa":[-24.5893,-52.7976],
  "SP|Paranapua":[-20.1048,-50.5886],
  "MT|agua Boa":[-14.051,-52.1601],
  "SC|Luzerna":[-27.1304,-51.4682],
  "PE|Afogados da Ingazeira":[-7.7431,-37.631],
  "SP|Bertioga":[-23.8486,-46.1396],
  "RN|Carnauba dos Dantas":[-6.5502,-36.5868],
  "MG|Sabinopolis":[-18.6653,-43.0752],
  "SC|Joinville":[-26.3045,-48.8487],
  "BA|Queimadas":[-10.9736,-39.6293],
  "SP|Icem":[-20.3391,-49.1915],
  "MT|Nova Xavantina":[-14.6771,-52.3502],
  "MA|Penalva":[-3.2767,-45.1768],
  "BA|Eunapolis":[-16.3715,-39.5821],
  "SP|Sao Simao":[-21.4732,-47.5518],
  "SP|Itirapina":[-22.2562,-47.8166],
  "PR|Cafezal do Sul":[-23.9005,-53.5124],
  "ES|Afonso Claudio":[-20.0778,-41.1261],
  "BA|Marau":[-14.1035,-39.0137],
  "RS|Nova Brescia":[-29.2182,-52.0319],
  "MT|Mirassol DOeste":[-15.6759,-58.0951],
  "MG|Jose Raydan":[-18.2195,-42.4946],
  "MG|Itambacuri":[-18.035,-41.683],
  "ES|Itarana":[-19.875,-40.8753],
  "RS|Ponte Preta":[-27.6587,-52.4848],
  "RS|Mampituba":[-29.2136,-49.9311],
  "SC|Bela Vista do Toldo":[-26.2746,-50.4664],
  "MA|Acailandia":[-4.9471,-47.5004],
  "MG|Jequeri":[-20.4542,-42.6651],
  "SP|Nazare Paulista":[-23.1747,-46.3983],
  "SP|Brauna":[-21.499,-50.3175],
  "GO|Rio Quente":[-17.774,-48.7725],
  "SP|Aspasia":[-20.16,-50.728],
  "RS|Capao da Canoa":[-29.7642,-50.0282],
  "PR|General Carneiro":[-26.425,-51.3172],
  "SP|Inubia Paulista":[-21.7695,-50.9633],
  "SP|Parisi":[-20.3034,-50.0163],
  "SP|Palmares Paulista":[-21.0854,-48.8037],
  "SC|Camboriu":[-27.0241,-48.6503],
  "SE|Pacatuba":[-10.4538,-36.6531],
  "GO|Uruana":[-15.4993,-49.6861],
  "SE|Amparo de Sao Francisco":[-10.1348,-36.935],
  "PR|Sao Jorge do Patrocinio":[-23.7647,-53.8823],
  "BA|Seabra":[-12.4169,-41.7722],
  "RN|Macaiba":[-5.8523,-35.3552],
  "CE|Quixada":[-4.9663,-39.0155],
  "MG|Entre Rios de Minas":[-20.6706,-44.0654],
  "PA|Porto de Moz":[-1.7469,-52.2361],
  "PR|Quedas do Iguacu":[-25.4492,-52.9102],
  "PB|Diamante":[-7.4174,-38.2615],
  "RS|Cristal":[-31.0046,-52.0436],
  "MG|Pratapolis":[-20.7411,-46.8624],
  "BA|Sao Miguel das Matas":[-13.0434,-39.4578],
  "SC|Pinhalzinho":[-26.8495,-52.9913],
  "PR|Doutor Camargo":[-23.5582,-52.2178],
  "SP|Guarulhos":[-23.4538,-46.5333],
  "SP|Santo Andre":[-23.6737,-46.5432],
  "RJ|Niteroi":[-22.8832,-43.1034],
  "SP|Praia Grande":[-24.0084,-46.4121],
  "SP|Barueri":[-23.5057,-46.879],
  "MG|Contagem":[-19.9321,-44.0539],
  "SP|Carapicuiba":[-23.5235,-46.8407],
  "SP|Itaquaquecetuba":[-23.4835,-46.3457],
  "SP|Diadema":[-23.6813,-46.6205],
  "PR|Londrina":[-23.304,-51.1691],
  "SP|Sumare":[-22.8204,-47.2728],
  "SP|Guaruja":[-23.9888,-46.258],
  "SP|Taboao da Serra":[-23.6019,-46.7526],
  "PE|Recife":[-8.0467,-34.8771],
  "SP|Suzano":[-23.5448,-46.3112],
  "SP|Hortolandia":[-22.8529,-47.2143],
  "MG|Betim":[-19.9668,-44.2008],
  "PR|Sao Jose dos Pinhais":[-25.5313,-49.2031],
  "SP|Taubate":[-23.0104,-45.5593],
  "SP|Paulinia":[-22.7542,-47.1488],
  "SP|Limeira":[-22.566,-47.397],
  "SP|Sao Caetano do Sul":[-23.6229,-46.5548],
  "SP|Presidente Prudente":[-22.1207,-51.3925],
  "RJ|Volta Redonda":[-22.5202,-44.0996],
  "MG|Ribeirao das Neves":[-19.7621,-44.0844],
  "SP|Atibaia":[-23.1171,-46.5563],
  "SP|Salto":[-23.1996,-47.2931],
  "RJ|Sao Joao de Meriti":[-22.8058,-43.3729],
  "PR|Ponta Grossa":[-25.0916,-50.1668],
  "RJ|Macae":[-22.3768,-41.7848],
  "SC|Itajai":[-26.9101,-48.6705],
  "RJ|Cabo Frio":[-22.8894,-42.0286],
  "PR|Colombo":[-25.2925,-49.2262],
  "SP|Santa Barbara DOeste":[-22.7553,-47.4143],
  "RJ|Nova Friburgo":[-22.2932,-42.5377],
  "SP|Itatiba":[-23.0035,-46.8464],
  "SP|Votorantim":[-23.5446,-47.4388],
  "SP|Jandira":[-23.5275,-46.9023],
  "BA|Feira de Santana":[-12.2664,-38.9663],
  "SP|Ferraz de Vasconcelos":[-23.5411,-46.371],
  "RJ|Marica":[-22.9354,-42.8246],
  "RJ|Belford Roxo":[-22.764,-43.3992],
  "SP|Itu":[-23.2544,-47.2927],
  "SP|Varzea Paulista":[-23.2136,-46.8234],
  "RJ|Teresopolis":[-22.4165,-42.9752],
  "MG|Vespasiano":[-19.6883,-43.9239],
  "SP|Ribeirao Pires":[-23.7067,-46.4058],
  "SP|Araras":[-22.3572,-47.3842],
  "RJ|Araruama":[-22.8697,-42.3326],
  "RJ|Resende":[-22.4705,-44.4509],
  "RJ|Itaguai":[-22.8636,-43.7798],
  "SP|Cajamar":[-23.355,-46.8781],
  "MG|Santa Luzia":[-19.7548,-43.8497],
  "PR|Foz do Iguacu":[-25.5427,-54.5827],
  "SP|Mairipora":[-23.3171,-46.5897],
  "MG|Montes Claros":[-16.7282,-43.8578],
  "RS|Novo Hamburgo":[-29.6875,-51.1328],
  "BA|Lauro de Freitas":[-12.8978,-38.321],
  "PR|Pinhais":[-25.4429,-49.1927],
  "SP|Itanhaem":[-24.1736,-46.788],
  "MG|Ibirite":[-20.0252,-44.0569],
  "RJ|Mage":[-22.6632,-43.0315],
  "RJ|Queimados":[-22.7102,-43.5518],
  "SP|Assis":[-22.66,-50.4183],
  "MG|Sete Lagoas":[-19.4569,-44.2413],
  "RJ|Nilopolis":[-22.8057,-43.4233],
  "RJ|Itaborai":[-22.7565,-42.8639],
  "RJ|Mesquita":[-22.8028,-43.4601],
  "RS|Sao Leopoldo":[-29.7545,-51.1498],
  "PR|Toledo":[-24.7246,-53.7412],
  "GO|Aparecida de Goiania":[-16.8198,-49.2469],
  "SP|Cacapava":[-23.0992,-45.7076],
  "SP|Boituva":[-23.2855,-47.6786],
  "RJ|Sao Pedro da Aldeia":[-22.8429,-42.1026],
  "PR|Piraquara":[-25.4422,-49.0624],
  "PR|Sarandi":[-23.4441,-51.876],
  "RJ|Barra do Pirai":[-22.4715,-43.8269],
  "SP|Monte Alegre do Sul":[-22.6817,-46.681],
  "GO|Rio Verde":[-17.7923,-50.9192],
  "SC|Itapema":[-27.0861,-48.616],
  "SP|Mombuca":[-22.9285,-47.559],
  "SP|Cerquilho":[-23.1665,-47.7459],
  "GO|Anapolis":[-16.3281,-48.953],
  "PR|Almirante Tamandare":[-25.3188,-49.3037],
  "SP|Mogi Guacu":[-22.3675,-46.9428],
  "SP|Monte Mor":[-22.945,-47.3122],
  "SP|Mongagua":[-24.0809,-46.6265],
  "PR|Campo Mourao":[-24.0463,-52.378],
  "PE|Jaboatao dos Guararapes":[-8.113,-35.015],
  "RJ|Japeri":[-22.6435,-43.6602],
  "RS|Alvorada":[-29.9914,-51.0809],
  "PR|Arapongas":[-23.4153,-51.4259],
  "SP|Vinhedo":[-23.0302,-46.9833],
  "PR|Araucaria":[-25.5859,-49.4047],
  "SP|Leme":[-22.1809,-47.3841],
  "PR|Umuarama":[-23.7656,-53.3201],
  "SP|Mairinque":[-23.5398,-47.185],
  "BA|Alagoinhas":[-12.1335,-38.4208],
  "SP|Vargem Grande Paulista":[-23.5993,-47.022],
  "PR|Fazenda Rio Grande":[-25.6624,-49.3073],
  "PE|Olinda":[-8.0102,-34.8545],
  "SP|Campo Limpo Paulista":[-23.2078,-46.7889],
  "SC|Tubarao":[-28.4713,-49.0144],
  "PR|Paranagua":[-25.5161,-48.5225],
  "SP|Mogi Mirim":[-22.4332,-46.9532],
  "SP|Cosmopolis":[-22.6419,-47.1926],
  "SP|Aracariguama":[-23.4366,-47.0608],
  "SC|Navegantes":[-26.8943,-48.6546],
  "PR|Paranavai":[-23.0816,-52.4617],
  "SP|Ibiuna":[-23.6596,-47.223],
  "MG|Sabara":[-19.884,-43.8263],
  "RJ|Mangaratiba":[-22.9594,-44.0409],
  "SP|Aracoiaba da Serra":[-23.5029,-47.6166],
  "PR|Apucarana":[-23.55,-51.4635],
  "RJ|Cachoeiras de Macacu":[-22.4658,-42.6523],
  "RJ|Casimiro de Abreu":[-22.4812,-42.2066],
  "RS|Esteio":[-29.852,-51.1841],
  "ES|Colatina":[-19.5493,-40.6269],
  "RS|Cachoeirinha":[-29.9472,-51.1016],
  "RS|Sapucaia do Sul":[-29.8276,-51.145],
  "MG|Uberaba":[-19.7472,-47.9381],
  "MG|Juatuba":[-19.9448,-44.3451],
  "SP|Porto Feliz":[-23.2093,-47.5251],
  "SP|Holambra":[-22.6405,-47.0487],
  "PE|Paulista":[-7.934,-34.8684],
  "SP|Ourinhos":[-22.9797,-49.8697],
  "RJ|Armacao dos Buzios":[-22.7528,-41.8846],
  "SP|Jarinu":[-23.1039,-46.728],
  "PR|Quatro Barras":[-25.3673,-49.0763],
  "RJ|Rio Bonito":[-22.7181,-42.6276],
  "SP|Capela do Alto":[-23.4685,-47.7388],
  "SP|Cabreuva":[-23.3053,-47.1362],
  "RJ|Vassouras":[-22.4059,-43.6686],
  "BA|Simoes Filho":[-12.7866,-38.4029],
  "SP|Pirapozinho":[-22.2711,-51.4976],
  "PR|Cianorte":[-23.6599,-52.6054],
  "PR|Cambe":[-23.2766,-51.2798],
  "RJ|Paracambi":[-22.6078,-43.7108],
  "RJ|Seropedica":[-22.7526,-43.7155],
  "PR|Cornelio Procopio":[-23.1829,-50.6498],
  "MG|Araguari":[-18.6456,-48.1934],
  "SP|Espirito Santo do Pinhal":[-22.1909,-46.7477],
  "SP|Tupa":[-21.9335,-50.5191],
  "SP|Capivari":[-22.9951,-47.5071],
  "SP|Paraguacu Paulista":[-22.4114,-50.5732],
  "SC|Imbituba":[-28.2284,-48.6659],
  "MG|Igarape":[-20.0707,-44.2994],
  "MG|Sao Jose da Lapa":[-19.6971,-43.9586],
  "PR|Campina Grande do Sul":[-25.3044,-49.0551],
  "BA|Paulo Afonso":[-9.3983,-38.2216],
  "PR|Jacarezinho":[-23.1591,-49.9739],
  "SP|Rio Grande da Serra":[-23.7437,-46.3971],
  "GO|Valparaiso de Goias":[-16.0651,-47.9757],
  "PR|Carambei":[-24.9152,-50.0986],
  "MG|Sarzedo":[-20.0367,-44.1446],
  "PR|Rolandia":[-23.3101,-51.3659],
  "RJ|Iguaba Grande":[-22.8495,-42.2299],
  "GO|Cidade Ocidental":[-16.0765,-47.9252],
  "SP|Tiete":[-23.1101,-47.7164],
  "SP|Rio das Pedras":[-22.8417,-47.6047],
  "SP|Engenheiro Coelho":[-22.4836,-47.211],
  "SP|Ipero":[-23.3513,-47.6927],
  "SP|Balsamo":[-20.7348,-49.5865],
  "MG|Monte Carmelo":[-18.7302,-47.4912],
  "SC|Garopaba":[-28.0275,-48.6192],
  "PR|Morretes":[-25.4744,-48.8345],
  "MG|Ituiutaba":[-18.9772,-49.4639],
  "SP|Ibirarema":[-22.8185,-50.0739],
  "RJ|Valenca":[-22.2445,-43.7129],
  "BA|Ipira":[-12.1561,-39.7359],
  "RS|Eldorado do Sul":[-30.0847,-51.6187],
  "SP|Pilar do Sul":[-23.8077,-47.7222],
  "SP|Juquitiba":[-23.9244,-47.0653],
  "MG|Sao Joaquim de Bicas":[-20.048,-44.2749],
  "SP|Morungaba":[-22.8811,-46.7896],
  "RS|Campo Bom":[-29.6747,-51.0606],
  "PR|Matinhos":[-25.8237,-48.549],
  "PR|Telemaco Borba":[-24.3245,-50.6176],
  "PR|Marialva":[-23.4843,-51.7928],
  "PR|Castro":[-24.7891,-50.0108],
  "SP|Piedade":[-23.7139,-47.4256],
  "BA|Juazeiro":[-9.4162,-40.5033],
  "SP|Iracemapolis":[-22.5832,-47.523],
  "SP|Pedreira":[-22.7413,-46.8948],
  "GO|Catalao":[-18.1656,-47.944],
  "SC|Laguna":[-28.4843,-48.7772],
  "BA|Serrinha":[-11.6584,-39.01],
  "GO|Luziania":[-16.253,-47.95],
  "BA|Canudos":[-9.9001,-39.1471],
  "SC|Jaguaruna":[-28.6146,-49.0296],
  "MG|Machado":[-21.6778,-45.9219],
  "RJ|Paty do Alferes":[-22.4309,-43.4285],
  "MG|Sao Gotardo":[-19.3087,-46.0465],
  "BA|Conceicao do Coite":[-11.56,-39.2808],
  "RJ|Pirai":[-22.6215,-43.9081],
  "PR|Assis Chateaubriand":[-24.4168,-53.5213],
  "SP|Conchal":[-22.3375,-47.1729],
  "RJ|Cordeiro":[-22.0267,-42.3648],
  "PR|Siqueira Campos":[-23.6875,-49.8304],
  "PR|Santo Antonio da Platina":[-23.2959,-50.0815],
  "SP|Pompeia":[-22.107,-50.176],
  "RJ|Itaperuna":[-21.1997,-41.8799],
  "BA|Euclides da Cunha":[-10.5078,-39.0153],
  "PR|Bandeirantes":[-23.1078,-50.3704],
  "PR|Nova Londrina":[-22.7639,-52.9868],
  "MG|Patrocinio":[-18.9379,-46.9934],
  "SP|Boa Esperanca do Sul":[-21.9918,-48.3906],
  "SC|Penha":[-26.7754,-48.6465],
  "SP|Artur Nogueira":[-22.5727,-47.1727],
  "MG|Araxa":[-19.5902,-46.9438],
  "MG|Matozinhos":[-19.5543,-44.0868],
  "RS|Rolante":[-29.6462,-50.5819],
  "BA|Maragogipe":[-12.776,-38.9175],
  "BA|Ribeira do Pombal":[-10.8373,-38.5382],
  "BA|Muritiba":[-12.6329,-38.9921],
  "PR|Campo Magro":[-25.3687,-49.4501],
  "PR|Perola":[-23.8039,-53.6834],
  "PR|Loanda":[-22.9232,-53.1362],
  "RJ|Sumidouro":[-22.0485,-42.6761],
  "RJ|Duas Barras":[-22.0536,-42.5232],
  "MG|Lagoa Formosa":[-18.7715,-46.4012],
  "SP|Cesario Lange":[-23.226,-47.9545],
  "SP|Estiva Gerbi":[-22.2713,-46.9481],
  "BA|Capela do Alto Alegre":[-11.6658,-39.8349],
  "SP|Duartina":[-22.4146,-49.4084],
  "BA|Pojuca":[-12.4303,-38.3374],
  "BA|Rio Real":[-11.4814,-37.9332],
  "PR|Bela Vista do Paraiso":[-22.9937,-51.1927],
  "RJ|Pinheiral":[-22.5172,-44.0022],
  "RJ|Mendes":[-22.5245,-43.7312],
  "SC|Imarui":[-28.3339,-48.817],
  "PR|Irati":[-25.4697,-50.6493],
  "PR|Goioere":[-24.1835,-53.0248],
  "RS|Sao Jeronimo":[-29.9716,-51.7251],
  "PR|Tibagi":[-24.5153,-50.4176],
  "RJ|Itatiaia":[-22.4897,-44.5675],
  "BA|Gandu":[-13.7441,-39.4747],
  "RJ|Bom Jardim":[-22.1545,-42.4251],
  "PR|Faxinal":[-24.0077,-51.3227],
  "SP|Garca":[-22.2125,-49.6546],
  "RJ|Miracema":[-21.4148,-42.1938],
  "SP|Santo Antonio de Posse":[-22.6029,-46.9192],
  "SP|Aluminio":[-23.5306,-47.2546],
  "SP|Santa Gertrudes":[-22.4572,-47.5272],
  "SP|Agudos":[-22.4694,-48.9863],
  "BA|Senhor do Bonfim":[-10.4594,-40.1865],
  "RJ|Sao Joao da Barra":[-21.638,-41.0446],
  "RJ|Quatis":[-22.4045,-44.2597],
  "GO|Alexania":[-16.0834,-48.5076],
  "PR|Pitanga":[-24.7588,-51.7596],
  "RJ|Carmo":[-21.931,-42.6046],
  "MG|Raposos":[-19.9636,-43.8079],
  "RJ|Miguel Pereira":[-22.4572,-43.4803],
  "PR|Borrazopolis":[-23.9366,-51.5875],
  "PR|Antonina":[-25.4386,-48.7191],
  "PE|Camaragibe":[-8.0235,-34.9782],
  "RS|Parobe":[-29.6243,-50.8312],
  "SP|Uchoa":[-20.9511,-49.1713],
  "BA|Jeremoabo":[-10.0685,-38.3471],
  "SC|Sao Ludgero":[-28.3144,-49.1806],
  "PR|Prudentopolis":[-25.2111,-50.9754],
  "BA|Candeias":[-12.6716,-38.5472],
  "MG|Caete":[-19.8826,-43.6704],
  "BA|Araci":[-11.3253,-38.9584],
  "BA|Nazare":[-13.0235,-39.0108],
  "SC|Braco do Norte":[-28.2681,-49.1701],
  "PR|Congonhinhas":[-23.5493,-50.5569],
  "BA|Sitio do Quinto":[-10.3545,-38.2213],
  "PR|Prado Ferreira":[-23.0357,-51.4429],
  "SP|Taruma":[-22.7429,-50.5786],
  "BA|Nova Soure":[-11.2329,-38.4871],
  "RJ|Rio Claro":[-22.72,-44.1419],
  "SP|Ribeirao Corrente":[-20.4579,-47.5904],
  "PR|Douradina":[-23.3807,-53.2918],
  "BA|Monte Santo":[-10.4374,-39.3321],
  "RS|Cidreira":[-30.1604,-50.2337],
  "MG|Poco Fundo":[-21.78,-45.9658],
  "BA|Governador Mangabeira":[-12.5994,-39.0412],
  "SC|Orleans":[-28.3487,-49.2986],
  "PR|Matelandia":[-25.2496,-53.9935],
  "RS|Igrejinha":[-29.5693,-50.7919],
  "PR|Guaira":[-24.085,-54.2573],
  "PR|Sabaudia":[-23.3155,-51.555],
  "SP|aguas da Prata":[-21.9319,-46.7176],
  "RJ|Carapebus":[-22.1821,-41.663],
  "SP|Tanabi":[-20.6228,-49.6563],
  "SP|Presidente Alves":[-22.0999,-49.4381],
  "BA|Ruy Barbosa":[-12.2816,-40.4931],
  "RS|Nova Santa Rita":[-29.8525,-51.2837],
  "BA|Tanquinho":[-11.968,-39.1033],
  "MG|Ibia":[-19.4749,-46.5474],
  "PR|Lunardelli":[-24.0821,-51.7368],
  "SP|Sarapui":[-23.6397,-47.8249],
  "BA|Santaluz":[-11.2508,-39.375],
  "PR|Centenario do Sul":[-22.8188,-51.5973],
  "PR|Rondon":[-23.412,-52.7659],
  "BA|Madre de Deus":[-12.7446,-38.6153],
  "SE|Estancia":[-11.2659,-37.4484],
  "RS|Portao":[-29.7015,-51.2429],
  "SP|Ipeuna":[-22.4355,-47.7151],
  "BA|Conceicao da Feira":[-12.5078,-38.9978],
  "MG|Abadia dos Dourados":[-18.4831,-47.3916],
  "PR|Mandaguari":[-23.5446,-51.671],
  "RJ|Guapimirim":[-22.5347,-42.9895],
  "RS|Sapiranga":[-29.6349,-51.0064],
  "RJ|Sao Fidelis":[-21.6551,-41.756],
  "SC|Paulo Lopes":[-27.9607,-48.6864],
  "BA|Sao Francisco do Conde":[-12.6183,-38.6786],
  "PR|Cambira":[-23.589,-51.5792],
  "PR|Ivaipora":[-24.2485,-51.6754],
  "SP|Monte Aprazivel":[-20.768,-49.7184],
  "RJ|Silva Jardim":[-22.6574,-42.3961],
  "SP|Divinolandia":[-21.6637,-46.7361],
  "MG|Cabo Verde":[-21.4699,-46.3919],
  "BA|Quijingue":[-10.7505,-39.2137],
  "PR|Cambara":[-23.0423,-50.0753],
  "PR|Urai":[-23.2,-50.7939],
  "RS|Dois Irmaos":[-29.5836,-51.0898],
  "MG|Alfenas":[-21.4256,-45.9477],
  "SP|Espirito Santo do Turvo":[-22.6925,-49.4341],
  "PR|Jaboti":[-23.7435,-50.0729],
  "BA|Entre Rios":[-11.9392,-38.0871],
  "PR|Barbosa Ferraz":[-24.0334,-52.004],
  "PR|Reserva":[-24.6492,-50.8466],
  "MG|Campos Altos":[-19.6914,-46.1725],
  "BA|Campo Formoso":[-10.5105,-40.32],
  "GO|Santo Antonio do Descoberto":[-15.9412,-48.2578],
  "BA|Valente":[-11.4062,-39.457],
  "MG|Nova Ponte":[-19.1461,-47.6779],
  "MG|Jacutinga":[-22.286,-46.6166],
  "BA|Macarani":[-15.5646,-40.4209],
  "PR|Japira":[-23.8142,-50.1422],
  "BA|Pe de Serra":[-11.8313,-39.611],
  "MG|Frutal":[-20.0259,-48.9355],
  "SP|Onda Verde":[-20.6042,-49.2929],
  "PR|Paicandu":[-23.4555,-52.046],
  "MG|Conceicao das Alagoas":[-19.9172,-48.3839],
  "BA|Serra Preta":[-12.156,-39.3305],
  "PR|Paranapoema":[-22.6412,-52.0905],
  "SP|Caconde":[-21.528,-46.6437],
  "SP|Cafelandia":[-21.8031,-49.6092],
  "BA|Esplanada":[-11.7942,-37.9432],
  "BA|Pindobacu":[-10.7433,-40.3675],
  "SC|Pescaria Brava":[-28.3966,-48.8864],
  "BA|Conceicao do Jacuipe":[-12.3268,-38.7684],
  "MG|Congonhal":[-22.1488,-46.043],
  "BA|Gaviao":[-11.4688,-39.7757],
  "MG|Itapagipe":[-19.9062,-49.3781],
  "BA|Sao Felix":[-12.6104,-38.9727],
  "SP|Bernardino de Campos":[-23.0164,-49.4679],
  "PR|Astorga":[-23.2318,-51.6668],
  "MG|Botelhos":[-21.6412,-46.391],
  "PR|Jandaia do Sul":[-23.6011,-51.6448],
  "RJ|Porto Real":[-22.4175,-44.2952],
  "SP|Salto Grande":[-22.8894,-49.9831],
  "BA|Santa Barbara":[-11.9515,-38.9681],
  "PR|Sao Miguel do Iguacu":[-25.3492,-54.2405],
  "PR|Assai":[-23.3697,-50.8459]
};


const C = {
  laranja: "#F97316", verde: "#16A34A", vermelho: "#DC2626", amarelo: "#CA8A04",
  azul: "#2563EB", cinzaFundo: "#F8F7F4", cinzaCard: "#FFFFFF", cinzaBorda: "#E5E3DF",
  cinzaTexto: "#6B7280", texto: "#1C1917",
};

// ── Persistência IndexedDB ────────────────────────────────────────────────────
const DB_NAME = "abrangenciaParcaDB2";
const STORE   = "dados";
function abrirDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror   = () => rej(r.error);
  });
}
async function salvarChave(chave, valor) {
  try {
    const db = await abrirDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(valor, chave);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
    return true;
  } catch { return false; }
}
async function carregarChave(chave) {
  try {
    const db = await abrirDB();
    return await new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(chave);
      req.onsuccess = () => res(req.result || null);
      req.onerror   = () => rej(req.error);
    });
  } catch { return null; }
}

// ── Grade esquemática do Brasil ───────────────────────────────────────────────
const GRADE_UF = [
  { uf:"RR", col:3, row:0 },
  { uf:"AM", col:1, row:1 }, { uf:"PA", col:3, row:1 }, { uf:"AP", col:4, row:1 }, { uf:"MA", col:6, row:1 },
  { uf:"AC", col:0, row:2 }, { uf:"RO", col:1, row:2 }, { uf:"TO", col:4, row:2 }, { uf:"PI", col:6, row:2 }, { uf:"CE", col:7, row:2 },
  { uf:"MT", col:2, row:3 }, { uf:"GO", col:4, row:3 }, { uf:"BA", col:6, row:3 }, { uf:"RN", col:8, row:3 },
  { uf:"MS", col:2, row:4 }, { uf:"DF", col:4, row:4 }, { uf:"PE", col:7, row:4 }, { uf:"PB", col:8, row:4 },
  { uf:"MG", col:4, row:5 }, { uf:"SE", col:6, row:4 }, { uf:"AL", col:7, row:5 },
  { uf:"SP", col:3, row:6 }, { uf:"RJ", col:5, row:6 }, { uf:"ES", col:6, row:5 },
  { uf:"PR", col:3, row:7 },
  { uf:"SC", col:3, row:8 },
  { uf:"RS", col:3, row:9 },
];

function normalizarCidade(s) {
  return String(s||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
}

function parseCSVAbrangencia(texto) {
  const { data } = Papa.parse(texto, { header:true, skipEmptyLines:true });
  return data
    .filter(r => r["Logistica Reversa Estado"] && r["Logistica Reversa Cidade"])
    .map(r => ({
      validacao:      String(r["VALIDAÇÃO"]||"").trim().toUpperCase(),
      transportadora: String(r["Logistica Reversa Transportadora"]||"").trim(),
      estado:         String(r["Logistica Reversa Estado"]||"").trim().toUpperCase(),
      cidade:         String(r["Logistica Reversa Cidade"]||"").trim(),
      abrangencia:    parseFloat(String(r["Abrangencia"]||"").replace(",",".")) || 0,
    }));
}

function chaveLinha(r) { return `${r.estado}|${normalizarCidade(r.cidade)}|${r.transportadora}`; }

function compararDatasets(anterior, atual) {
  const mapAnt = new Map(anterior.map(r=>[chaveLinha(r),r]));
  const mapAt  = new Map(atual.map(r=>[chaveLinha(r),r]));
  const novas=[]; const mudancas=[];
  for (const [k,r] of mapAt) {
    const a = mapAnt.get(k);
    if (!a) novas.push(r);
    else if (a.validacao!==r.validacao || a.abrangencia!==r.abrangencia) mudancas.push({antes:a,depois:r});
  }
  const removidas=[...mapAnt.entries()].filter(([k])=>!mapAt.has(k)).map(([,r])=>r);
  return { novas, removidas, mudancas };
}

function resumoPorUF(linhas) {
  const m={};
  linhas.forEach(r=>{
    if (!m[r.estado]) m[r.estado]={total:0,parca:0,cidades:new Set(),abrangenciaTotal:0,abrangenciaParca:0,transportadorasParca:new Set()};
    m[r.estado].total++;
    m[r.estado].cidades.add(normalizarCidade(r.cidade));
    m[r.estado].abrangenciaTotal += r.abrangencia;
    if (r.validacao==="PARÇA") { m[r.estado].parca++; m[r.estado].abrangenciaParca+=r.abrangencia; m[r.estado].transportadorasParca.add(r.transportadora); }
  });
  return m;
}

function calcularOportunidades(linhas) {
  const pc = new Map();
  linhas.forEach(r=>{
    const k=`${r.estado}|${normalizarCidade(r.cidade)}`;
    if (!pc.has(k)) pc.set(k,{estado:r.estado,cidade:r.cidade,temParca:false,abrangencia:0,transportadoras:new Set()});
    const c=pc.get(k); c.abrangencia+=r.abrangencia;
    if (r.validacao==="PARÇA") c.temParca=true; else c.transportadoras.add(r.transportadora);
  });
  return [...pc.values()].filter(c=>!c.temParca)
    .sort((a,b)=>b.abrangencia-a.abrangencia)
    .map(c=>({...c, transportadoras:[...c.transportadoras].join(", ")}));
}

function corDoBloco(d) {
  if (!d || d.abrangenciaTotal===0) return "#E5E3DF";
  const p = d.abrangenciaParca/d.abrangenciaTotal;
  if (p>=0.75) return "#16A34A";
  if (p>=0.4)  return "#84CC16";
  if (p>0)     return "#F59E0B";
  return "#DC2626";
}

// ── Helper para gerar CSV de download ─────────────────────────────────────────
function gerarCSVDownload(rows) {
  const header = "VALIDAÇÃO,Logistica Reversa Transportadora,Logistica Reversa Estado,Logistica Reversa Cidade,Abrangencia";
  const linhas = rows.map(r=>`${r.validacao},${r.transportadora},${r.estado},${r.cidade},${r.abrangencia}`);
  return [header,...linhas].join("\n");
}

// ── Pill de filtro reutilizável ───────────────────────────────────────────────
function Pill({ ativo, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding:"5px 12px", borderRadius:999, fontSize:12, fontWeight:600, cursor:"pointer",
      border:`1.5px solid ${ativo ? C.laranja : C.cinzaBorda}`,
      background: ativo ? `${C.laranja}18` : "transparent",
      color: ativo ? C.laranja : C.cinzaTexto,
    }}>{children}</button>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function AbrangenciaApp() {
  const [aba,  setAba]  = useState("geral");
  const [atual,    setAtual]    = useState(null);
  const [anterior, setAnterior] = useState(null);
  const [loading,  setLoading]  = useState("");
  const [erro,     setErro]     = useState("");
  const [avisoPersist, setAvisoPersist] = useState(false);

  // ── Estado dos filtros da Visão Geral
  const [fgValidacao, setFgValidacao] = useState("Todos"); // Todos | PARÇA | NÃO PARÇA
  const [fgEstado,    setFgEstado]    = useState("Todos");

  // ── Estado do mapa
  const [ufSelecionada,  setUfSelecionada]  = useState(null);
  const [fMapaValidacao, setFMapaValidacao] = useState("Todos");

  // ── Estado de Oportunidades
  const [fOpEstado, setFOpEstado] = useState("Todos");

  useEffect(() => {
    (async () => {
      const a = await carregarChave("atual");
      const b = await carregarChave("anterior");
      if (a) setAtual(a);
      if (b) setAnterior(b);
    })();
  }, []);

  const handleUpload = useCallback((file) => {
    setLoading(file.name); setErro("");
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const rows = parseCSVAbrangencia(ev.target.result);
        if (!rows.length) throw new Error("Arquivo sem linhas válidas — confira as colunas: VALIDAÇÃO, Logistica Reversa Transportadora, Logistica Reversa Estado, Logistica Reversa Cidade, Abrangencia.");
        const novoAtual = { rows, nome:file.name, data:new Date().toISOString(), csvRaw:ev.target.result };
        if (atual) { await salvarChave("anterior", atual); setAnterior(atual); }
        const ok = await salvarChave("atual", novoAtual);
        setAtual(novoAtual); setAvisoPersist(!ok);
      } catch(e) { setErro(e.message||String(e)); } finally { setLoading(""); }
    };
    reader.onerror = () => { setErro("Erro ao ler o arquivo."); setLoading(""); };
    reader.readAsText(file);
  }, [atual]);

  const baixarUltimaImportada = useCallback(() => {
    if (!atual) return;
    const csv = atual.csvRaw || gerarCSVDownload(atual.rows);
    const blob = new Blob([csv], { type:"text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href=url; a.download=atual.nome||"abrangencia-parca.csv"; a.click();
    URL.revokeObjectURL(url);
  }, [atual]);

  // ── Dados derivados ────────────────────────────────────────────────────────
  const estadosDisponiveis = useMemo(() =>
    atual ? [...new Set(atual.rows.map(r=>r.estado))].sort() : [],
  [atual]);

  // Filtro Visão Geral
  const rowsFiltradas = useMemo(() => {
    if (!atual) return [];
    return atual.rows.filter(r =>
      (fgValidacao==="Todos" || r.validacao===fgValidacao) &&
      (fgEstado   ==="Todos" || r.estado   ===fgEstado)
    );
  }, [atual, fgValidacao, fgEstado]);

  const totais = useMemo(() => {
    if (!atual) return null;
    const rows = rowsFiltradas;
    const cidades = new Set(rows.map(r=>`${r.estado}|${normalizarCidade(r.cidade)}`));
    const estados = new Set(rows.map(r=>r.estado));
    const transp  = new Set(rows.map(r=>r.transportadora));
    const transpParca = new Set(rows.filter(r=>r.validacao==="PARÇA").map(r=>r.transportadora));
    const abrangenciaTotal  = rows.reduce((s,r)=>s+r.abrangencia,0);
    const abrangenciaParca  = rows.filter(r=>r.validacao==="PARÇA").reduce((s,r)=>s+r.abrangencia,0);
    return {
      totalColetas: abrangenciaTotal,
      cidades: cidades.size,
      estados: estados.size,
      transportadoras: transp.size,
      transportadorasParca: transpParca.size,
      pctTranspParca: transp.size ? (transpParca.size/transp.size)*100 : 0,
      pctPonderada: abrangenciaTotal ? (abrangenciaParca/abrangenciaTotal)*100 : 0,
      abrangenciaTotal, abrangenciaParca,
    };
  }, [rowsFiltradas]);

  const resumoUF = useMemo(() => atual ? resumoPorUF(atual.rows) : {}, [atual]);

  const oportunidades = useMemo(() => atual ? calcularOportunidades(atual.rows) : [], [atual]);
  const oportunidadesPorUF = useMemo(() => {
    const m={};
    oportunidades.forEach(o=>{ m[o.estado]=(m[o.estado]||0)+o.abrangencia; });
    return m;
  }, [oportunidades]);
  const topOportunidadeUFs = useMemo(() =>
    new Set(Object.entries(oportunidadesPorUF).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([uf])=>uf))
  , [oportunidadesPorUF]);

  // Linhas do painel de detalhe do estado (mapa) — filtradas por validação e ordenadas por abrangência desc
  const linhasDaUF = useMemo(() => {
    if (!atual||!ufSelecionada) return [];
    return atual.rows
      .filter(r => r.estado===ufSelecionada && (fMapaValidacao==="Todos" || r.validacao===fMapaValidacao))
      .sort((a,b)=>b.abrangencia-a.abrangencia);
  }, [atual, ufSelecionada, fMapaValidacao]);

  // Oportunidades filtradas por estado
  const oportunidadesFiltradas = useMemo(() =>
    fOpEstado==="Todos" ? oportunidades : oportunidades.filter(o=>o.estado===fOpEstado)
  , [oportunidades, fOpEstado]);

  const estadosOportunidade = useMemo(() =>
    [...new Set(oportunidades.map(o=>o.estado))].sort()
  , [oportunidades]);

  const comparacao = useMemo(() => {
    if (!atual||!anterior) return null;
    return compararDatasets(anterior.rows, atual.rows);
  }, [atual, anterior]);

  const sq = (s) => ({ padding:"6px 10px", borderRadius:6, border:`1px solid ${C.cinzaBorda}`, fontSize:12, fontWeight:600, cursor:"pointer", background:"transparent", color:C.cinzaTexto });

  return (
    <div style={{ maxWidth:1280, margin:"0 auto", padding:"20px 24px" }}>
      {/* ── Cabeçalho ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700 }}>🗺️ Abrangência Parça</div>
          <div style={{ fontSize:12, color:C.cinzaTexto }}>Cobertura de transportadoras parceiras por cidade — base de logística reversa</div>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", justifyContent:"flex-end" }}>
          <a href="/modelo-abrangencia-parca.csv" download
            style={{ padding:"8px 14px", borderRadius:8, border:`1.5px solid ${C.cinzaBorda}`, fontSize:13, fontWeight:600, textDecoration:"none", color:C.texto }}>
            ⬇ Baixar modelo (.csv)
          </a>
          {atual && (
            <button onClick={baixarUltimaImportada}
              style={{ padding:"8px 14px", borderRadius:8, border:`1.5px solid ${C.cinzaBorda}`, fontSize:13, fontWeight:600, cursor:"pointer", background:"transparent", color:C.texto }}>
              ⬇ Baixar última importada
            </button>
          )}
          <label style={{ padding:"8px 14px", borderRadius:8, background:C.laranja, color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer" }}>
            <input type="file" accept=".csv" style={{ display:"none" }} onChange={e=>{ if(e.target.files[0]) handleUpload(e.target.files[0]); e.target.value=""; }} />
            📂 Importar planilha
          </label>
        </div>
      </div>
      <div style={{ fontSize:11, color:C.cinzaTexto, marginBottom:14 }}>
        O modelo pra download é a própria base de logística reversa (mesmo formato de sempre) — baixe, atualize com a abrangência do ano inteiro e reimporte.
      </div>

      {loading && <div style={{ fontSize:13, color:C.laranja, marginBottom:12 }}>⏳ Processando {loading}...</div>}
      {erro && <div style={{ padding:12, background:"#FEE2E2", border:"1px solid #DC2626", borderRadius:8, color:"#991B1B", fontSize:13, marginBottom:12 }}>⚠️ {erro}</div>}
      {avisoPersist && <div style={{ padding:10, background:"#FEF3C7", border:"1px solid #FBBF24", borderRadius:8, color:"#92400E", fontSize:12, marginBottom:12 }}>⚠️ Não consegui salvar neste navegador — será preciso reimportar ao recarregar a página.</div>}

      {!atual ? (
        <div style={{ background:C.cinzaCard, border:`1px solid ${C.cinzaBorda}`, borderRadius:12, padding:40, textAlign:"center", color:C.cinzaTexto }}>
          Nenhuma planilha importada ainda. Baixe o modelo, preencha com a abrangência do ano inteiro e importe acima.
        </div>
      ) : (
        <>
          <div style={{ fontSize:12, color:C.cinzaTexto, marginBottom:14 }}>
            Base atual: <strong>{atual.nome}</strong> · importada em {new Date(atual.data).toLocaleString("pt-BR")}
            {anterior && <> · anterior: <strong>{anterior.nome}</strong> ({new Date(anterior.data).toLocaleString("pt-BR")})</>}
          </div>

          {/* ── Abas ── */}
          <div style={{ display:"flex", gap:8, marginBottom:16 }}>
            {[["geral","🏠 Visão Geral"],["mapa","🗺️ Mapa"],["oportunidades","🎯 Oportunidades"],["comparacao","🔄 Comparação"]].map(([k,l])=>(
              <button key={k} onClick={()=>setAba(k)} style={{
                padding:"8px 16px", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer",
                border:`1.5px solid ${aba===k?C.laranja:C.cinzaBorda}`,
                background:aba===k?`${C.laranja}18`:"transparent",
                color:aba===k?C.laranja:C.cinzaTexto,
              }}>{l}</button>
            ))}
          </div>

          {/* ══ VISÃO GERAL ══ */}
          {aba==="geral" && (
            <>
              {/* Filtros */}
              <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
                <span style={{ fontSize:12, fontWeight:700, color:C.cinzaTexto }}>Filtrar:</span>
                {["Todos","PARÇA","NÃO PARÇA"].map(v=>(
                  <Pill key={v} ativo={fgValidacao===v} onClick={()=>setFgValidacao(v)}>{v}</Pill>
                ))}
                <select value={fgEstado} onChange={e=>setFgEstado(e.target.value)}
                  style={{ padding:"5px 10px", borderRadius:6, border:`1.5px solid ${fgEstado!=="Todos"?C.laranja:C.cinzaBorda}`, fontSize:12, fontWeight:600, cursor:"pointer", color:fgEstado!=="Todos"?C.laranja:C.cinzaTexto }}>
                  <option value="Todos">Todos os estados</option>
                  {estadosDisponiveis.map(e=><option key={e} value={e}>{e}</option>)}
                </select>
                {(fgValidacao!=="Todos"||fgEstado!=="Todos") && (
                  <button onClick={()=>{setFgValidacao("Todos");setFgEstado("Todos");}} style={sq()}>Limpar filtros</button>
                )}
              </div>

              {/* KPIs */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:14, marginBottom:16 }}>
                <Kpi label="Total de coletas" valor={totais.totalColetas.toLocaleString("pt-BR")} />
                <Kpi label="Cidades atendidas" valor={totais.cidades.toLocaleString("pt-BR")} />
                <Kpi label="Estados" valor={totais.estados.toLocaleString("pt-BR")} />
                <Kpi label="Transportadoras" valor={totais.transportadoras.toLocaleString("pt-BR")} />
                <Kpi label="% transportadoras que são Parça" valor={`${totais.pctTranspParca.toFixed(1)}%`}
                  sub={`${totais.transportadorasParca} de ${totais.transportadoras}`}
                  cor={totais.pctTranspParca>=50?C.verde:C.vermelho} />
              </div>

              {/* Card cobertura ponderada */}
              <div style={{ background:C.cinzaCard, border:`2px solid ${C.laranja}`, borderRadius:12, padding:20, maxWidth:380 }}>
                <div style={{ fontSize:12, color:C.cinzaTexto, marginBottom:4 }}>Cobertura Parça</div>
                <div style={{ fontSize:36, fontWeight:700, color:totais.pctPonderada>=50?C.verde:C.vermelho }}>{totais.pctPonderada.toFixed(1)}%</div>
                <div style={{ fontSize:12, color:C.cinzaTexto, marginTop:4 }}>
                  {totais.abrangenciaParca.toLocaleString("pt-BR")} de {totais.abrangenciaTotal.toLocaleString("pt-BR")} de Abrangência em atendimentos Parça
                </div>
              </div>
            </>
          )}

          {/* ══ MAPA ══ */}
          {aba==="mapa" && (
            <MapaAbrangencia rows={atual.rows} coordCidades={COORD_CIDADES} />
          )}

          {/* ══ OPORTUNIDADES ══ */}
          {aba==="oportunidades" && (
            <div style={{ background:C.cinzaCard, border:`1px solid ${C.cinzaBorda}`, borderRadius:12, padding:20 }}>
              <div style={{ fontWeight:700, fontSize:15, marginBottom:6 }}>🎯 Onde priorizar novos parceiros</div>
              <div style={{ fontSize:13, color:C.cinzaTexto, marginBottom:16, lineHeight:1.5 }}>
                Cidades sem <strong>nenhuma transportadora Parça</strong>, ordenadas pelo volume (Abrangência) que passa por transportadoras não-parceiras.
              </div>

              {/* Filtro por estado */}
              <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
                <span style={{ fontSize:12, fontWeight:700, color:C.cinzaTexto }}>Estado:</span>
                <select value={fOpEstado} onChange={e=>setFOpEstado(e.target.value)}
                  style={{ padding:"5px 10px", borderRadius:6, border:`1.5px solid ${fOpEstado!=="Todos"?C.laranja:C.cinzaBorda}`, fontSize:12, fontWeight:600, cursor:"pointer", color:fOpEstado!=="Todos"?C.laranja:C.cinzaTexto }}>
                  <option value="Todos">Todos os estados</option>
                  {estadosOportunidade.map(e=><option key={e} value={e}>{e}</option>)}
                </select>
                {fOpEstado!=="Todos" && <button onClick={()=>setFOpEstado("Todos")} style={sq()}>Limpar</button>}
              </div>

              {oportunidadesFiltradas.length===0 ? (
                <div style={{ fontSize:13, color:C.verde, fontWeight:600 }}>✓ Todas as cidades já têm pelo menos uma opção Parça.</div>
              ) : (
                <>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:20 }}>
                    <Kpi label="Cidades sem nenhuma opção Parça" valor={oportunidadesFiltradas.length.toLocaleString("pt-BR")} cor={C.vermelho} />
                    <Kpi label="Volume de coletas em jogo" valor={oportunidadesFiltradas.reduce((s,o)=>s+o.abrangencia,0).toLocaleString("pt-BR")} cor={C.amarelo} />
                    <Kpi label="Estados envolvidos" valor={[...new Set(oportunidadesFiltradas.map(o=>o.estado))].length} />
                  </div>

                  {fOpEstado==="Todos" && (
                    <>
                      <div style={{ fontWeight:700, fontSize:13, marginBottom:8 }}>Por estado (ordenado por volume)</div>
                      <table style={{ width:"100%", fontSize:12, borderCollapse:"collapse", marginBottom:24 }}>
                        <thead>
                          <tr style={{ textAlign:"left", color:C.cinzaTexto }}>
                            <th style={{ padding:"4px 6px" }}>Estado</th>
                            <th style={{ padding:"4px 6px", textAlign:"right" }}>Volume sem Parça</th>
                            <th style={{ padding:"4px 6px", textAlign:"right" }}>Cidades</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(oportunidadesPorUF).sort((a,b)=>b[1]-a[1]).map(([uf,v])=>(
                            <tr key={uf} style={{ borderTop:`1px solid ${C.cinzaBorda}` }}>
                              <td style={{ padding:"4px 6px", fontWeight:600 }}>{topOportunidadeUFs.has(uf)&&"🎯 "}{uf}</td>
                              <td style={{ padding:"4px 6px", textAlign:"right" }}>{v.toLocaleString("pt-BR")}</td>
                              <td style={{ padding:"4px 6px", textAlign:"right" }}>{oportunidades.filter(o=>o.estado===uf).length}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  <div style={{ fontWeight:700, fontSize:13, marginBottom:8 }}>
                    {fOpEstado==="Todos" ? `Top ${Math.min(30,oportunidadesFiltradas.length)} cidades por volume` : `Cidades de ${fOpEstado} sem Parça`}
                  </div>
                  <table style={{ width:"100%", fontSize:12, borderCollapse:"collapse" }}>
                    <thead>
                      <tr style={{ textAlign:"left", color:C.cinzaTexto }}>
                        <th style={{ padding:"4px 6px" }}>#</th>
                        <th style={{ padding:"4px 6px" }}>Estado</th>
                        <th style={{ padding:"4px 6px" }}>Cidade</th>
                        <th style={{ padding:"4px 6px", textAlign:"right" }}>Coletas ↓</th>
                        <th style={{ padding:"4px 6px" }}>Transportadora(s) atual(is)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(fOpEstado==="Todos"?oportunidadesFiltradas.slice(0,30):oportunidadesFiltradas).map((o,i)=>(
                        <tr key={i} style={{ borderTop:`1px solid ${C.cinzaBorda}` }}>
                          <td style={{ padding:"4px 6px", color:C.cinzaTexto }}>{i+1}</td>
                          <td style={{ padding:"4px 6px" }}>{o.estado}</td>
                          <td style={{ padding:"4px 6px" }}>{o.cidade}</td>
                          <td style={{ padding:"4px 6px", textAlign:"right", fontWeight:700, color:C.vermelho }}>{o.abrangencia.toLocaleString("pt-BR")}</td>
                          <td style={{ padding:"4px 6px" }}>{o.transportadoras}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}

          {/* ══ COMPARAÇÃO ══ */}
          {aba==="comparacao" && (
            <div style={{ background:C.cinzaCard, border:`1px solid ${C.cinzaBorda}`, borderRadius:12, padding:20 }}>
              {!anterior ? (
                <div style={{ color:C.cinzaTexto, fontSize:13 }}>Ainda não há planilha anterior pra comparar — aparece automaticamente a partir da segunda importação.</div>
              ) : (
                <>
                  <div style={{ fontSize:13, color:C.cinzaTexto, marginBottom:14 }}>
                    Comparando <strong>{anterior.nome}</strong> (anterior) com <strong>{atual.nome}</strong> (atual).
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:20 }}>
                    <Kpi label="Atendimentos novos"     valor={comparacao.novas.length}    cor={C.verde}    />
                    <Kpi label="Atendimentos removidos" valor={comparacao.removidas.length} cor={C.vermelho} />
                    <Kpi label="Atendimentos alterados" valor={comparacao.mudancas.length}  cor={C.amarelo}  />
                  </div>
                  {comparacao.novas.length>0    && <TabelaSimples titulo="✅ Novos atendimentos"      linhas={comparacao.novas} />}
                  {comparacao.removidas.length>0 && <TabelaSimples titulo="❌ Atendimentos removidos"  linhas={comparacao.removidas} />}
                  {comparacao.mudancas.length>0  && (
                    <div style={{ marginTop:20 }}>
                      <div style={{ fontWeight:700, marginBottom:8, fontSize:13 }}>🔁 Atendimentos que mudaram</div>
                      <table style={{ width:"100%", fontSize:12, borderCollapse:"collapse" }}>
                        <thead>
                          <tr style={{ textAlign:"left", color:C.cinzaTexto }}>
                            <th style={{ padding:"4px 6px" }}>Cidade</th>
                            <th style={{ padding:"4px 6px" }}>Transportadora</th>
                            <th style={{ padding:"4px 6px" }}>Validação (antes → depois)</th>
                            <th style={{ padding:"4px 6px", textAlign:"right" }}>Abrangência (antes → depois)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comparacao.mudancas.map((m,i)=>(
                            <tr key={i} style={{ borderTop:`1px solid ${C.cinzaBorda}` }}>
                              <td style={{ padding:"4px 6px" }}>{m.depois.estado} — {m.depois.cidade}</td>
                              <td style={{ padding:"4px 6px" }}>{m.depois.transportadora}</td>
                              <td style={{ padding:"4px 6px" }}>{m.antes.validacao} → {m.depois.validacao}</td>
                              <td style={{ padding:"4px 6px", textAlign:"right" }}>{m.antes.abrangencia} → {m.depois.abrangencia}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {!comparacao.novas.length && !comparacao.removidas.length && !comparacao.mudancas.length && (
                    <div style={{ color:C.cinzaTexto, fontSize:13 }}>Nenhuma diferença encontrada.</div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Projeção geográfica (Mercator simplificada) ───────────────────────────────
// Limites do Brasil: lat -33.75 a 5.27, lon -73.99 a -28.85
const LAT_MIN=-33.75, LAT_MAX=5.27, LON_MIN=-73.99, LON_MAX=-28.85;
const SVG_W=700, SVG_H=620;
function proj(lat, lon) {
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * SVG_W;
  const y = SVG_H - ((lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * SVG_H;
  return [Math.round(x*10)/10, Math.round(y*10)/10];
}

function MapaGeografico({ rows, oportunidadeUFs }) {
  const [filtro, setFiltro] = useState("Todos");
  const [tooltip, setTooltip] = useState(null); // {x,y,cidade,uf,validacao,abrangencia,transportadora}
  const [ufFoco, setUfFoco] = useState(null);

  // Agrega por cidade (somando abrangência de todas as linhas daquela cidade)
  const pontos = useMemo(() => {
    const mapa = new Map();
    rows.forEach(r => {
      const key = `${r.estado}|${r.cidade}`;
      const coord = COORD_CIDADES[key];
      if (!coord) return;
      if (!mapa.has(key)) {
        mapa.set(key, {
          uf: r.estado, cidade: r.cidade,
          lat: coord[0], lon: coord[1],
          abrangenciaTotal: 0, abrangenciaParca: 0,
          temParca: false, temNaoParca: false,
          linhas: [],
        });
      }
      const p = mapa.get(key);
      p.abrangenciaTotal += r.abrangencia;
      if (r.validacao === "PARÇA") { p.abrangenciaParca += r.abrangencia; p.temParca = true; }
      else p.temNaoParca = true;
      p.linhas.push(r);
    });
    return [...mapa.values()].map(p => {
      const pct = p.abrangenciaTotal > 0 ? p.abrangenciaParca / p.abrangenciaTotal : 0;
      const [sx, sy] = proj(p.lat, p.lon);
      // Tamanho do ponto proporcional à Abrangência total (min 3, max 16)
      const r = Math.min(16, Math.max(3, Math.sqrt(p.abrangenciaTotal) * 0.6));
      // Cor: verde = 100% Parça, amarelo = misto, vermelho = 0% Parça
      let cor;
      if (pct >= 0.99) cor = "#16A34A";
      else if (pct >= 0.5) cor = "#84CC16";
      else if (pct > 0) cor = "#F59E0B";
      else cor = "#DC2626";
      return { ...p, pct, sx, sy, r, cor };
    });
  }, [rows]);

  const pontosFiltrados = useMemo(() => {
    let p = pontos;
    if (filtro === "PARÇA") p = p.filter(c => c.temParca);
    else if (filtro === "NÃO PARÇA") p = p.filter(c => c.temNaoParca && !c.temParca);
    if (ufFoco) p = p.filter(c => c.uf === ufFoco);
    return p;
  }, [pontos, filtro, ufFoco]);

  // Detalhe do painel lateral (cidades do UF em foco, ordenadas por abrangência desc)
  const detalheUF = useMemo(() => {
    if (!ufFoco) return [];
    return rows.filter(r=>r.estado===ufFoco)
      .sort((a,b)=>b.abrangencia-a.abrangencia);
  }, [rows, ufFoco]);

  const ufsDisponiveis = useMemo(() =>
    [...new Set(rows.map(r=>r.estado))].sort()
  , [rows]);

  return (
    <div>
      {/* Filtros */}
      <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
        <span style={{ fontSize:12, fontWeight:700, color:C.cinzaTexto }}>Mostrar:</span>
        {["Todos","PARÇA","NÃO PARÇA"].map(v=>(
          <Pill key={v} ativo={filtro===v} onClick={()=>setFiltro(v)}>{v}</Pill>
        ))}
        <select value={ufFoco||""} onChange={e=>setUfFoco(e.target.value||null)}
          style={{ padding:"5px 10px", borderRadius:6, border:`1.5px solid ${ufFoco?C.laranja:C.cinzaBorda}`, fontSize:12, fontWeight:600, cursor:"pointer", color:ufFoco?C.laranja:C.cinzaTexto }}>
          <option value="">Todos os estados</option>
          {ufsDisponiveis.map(u=><option key={u} value={u}>{u}</option>)}
        </select>
        {ufFoco && <button onClick={()=>setUfFoco(null)} style={{ padding:"5px 10px", borderRadius:6, border:`1px solid ${C.cinzaBorda}`, background:"transparent", fontSize:12, cursor:"pointer", color:C.cinzaTexto }}>Limpar</button>}
      </div>

      <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
        {/* SVG do mapa */}
        <div style={{ background:C.cinzaCard, border:`1px solid ${C.cinzaBorda}`, borderRadius:12, padding:16, position:"relative", flex:"0 0 auto" }}>
          <div style={{ fontSize:11, color:C.cinzaTexto, marginBottom:8 }}>
            Cada ponto é uma cidade. Tamanho = volume de coletas (Abrangência). Clique pra ver detalhes do estado.
          </div>
          <svg width={SVG_W} height={SVG_H} style={{ display:"block", background:"#EBF4FF", borderRadius:8 }}
            onMouseLeave={()=>setTooltip(null)}>

            {/* Fundo oceano já vem do background acima */}
            {/* Pontos das cidades */}
            {pontosFiltrados
              .sort((a,b)=>a.abrangenciaTotal-b.abrangenciaTotal) // menores por baixo
              .map((p,i)=>(
              <circle key={i}
                cx={p.sx} cy={p.sy} r={p.r}
                fill={p.cor}
                fillOpacity={ufFoco && p.uf!==ufFoco ? 0.15 : 0.85}
                stroke="#fff" strokeWidth={0.8}
                style={{ cursor:"pointer" }}
                onClick={()=>setUfFoco(p.uf===ufFoco ? null : p.uf)}
                onMouseEnter={(e)=>{
                  const rect = e.currentTarget.closest('svg').getBoundingClientRect();
                  setTooltip({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                    cidade: p.cidade, uf: p.uf,
                    pct: p.pct, abrangencia: p.abrangenciaTotal,
                    parcaAbs: p.abrangenciaParca,
                  });
                }}
              />
            ))}
          </svg>

          {/* Tooltip */}
          {tooltip && (
            <div style={{
              position:"absolute",
              left: tooltip.x + 12, top: tooltip.y - 10,
              background:"#1C1917", color:"#fff", borderRadius:8, padding:"8px 12px",
              fontSize:12, pointerEvents:"none", zIndex:10, whiteSpace:"nowrap",
              boxShadow:"0 4px 12px rgba(0,0,0,0.3)",
            }}>
              <div style={{ fontWeight:700, marginBottom:2 }}>{tooltip.cidade} — {tooltip.uf}</div>
              <div>Coletas: <strong>{tooltip.abrangencia.toLocaleString("pt-BR")}</strong></div>
              <div>Cobertura Parça: <strong style={{ color: tooltip.pct>=0.5?"#86EFAC":"#FCA5A5" }}>{(tooltip.pct*100).toFixed(0)}%</strong></div>
            </div>
          )}

          {/* Legenda */}
          <div style={{ display:"flex", gap:14, marginTop:10, fontSize:11, color:C.cinzaTexto, flexWrap:"wrap" }}>
            <Legenda cor="#16A34A" texto="100% Parça" />
            <Legenda cor="#84CC16" texto="≥50% Parça" />
            <Legenda cor="#F59E0B" texto="<50% Parça (misto)" />
            <Legenda cor="#DC2626" texto="0% Parça" />
            <span style={{ color:C.cinzaTexto }}>● Tamanho = Abrangência</span>
          </div>
        </div>

        {/* Painel de detalhe do estado */}
        {ufFoco && (
          <div style={{ flex:1, minWidth:320, background:C.cinzaCard, border:`1px solid ${C.cinzaBorda}`, borderRadius:12, padding:20, maxHeight:660, overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <div style={{ fontWeight:700, fontSize:14 }}>{ufFoco} — {detalheUF.length} atendimento(s)</div>
              <button onClick={()=>setUfFoco(null)} style={{ background:"none", border:"none", cursor:"pointer", color:C.cinzaTexto, fontSize:16 }}>✕</button>
            </div>
            <table style={{ width:"100%", fontSize:12, borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ textAlign:"left", color:C.cinzaTexto }}>
                  <th style={{ padding:"4px 6px" }}>Cidade</th>
                  <th style={{ padding:"4px 6px" }}>Transportadora</th>
                  <th style={{ padding:"4px 6px" }}>Validação</th>
                  <th style={{ padding:"4px 6px", textAlign:"right" }}>Coletas ↓</th>
                </tr>
              </thead>
              <tbody>
                {detalheUF.map((r,i)=>(
                  <tr key={i} style={{ borderTop:`1px solid ${C.cinzaBorda}` }}>
                    <td style={{ padding:"4px 6px" }}>{r.cidade}</td>
                    <td style={{ padding:"4px 6px" }}>{r.transportadora}</td>
                    <td style={{ padding:"4px 6px", color:r.validacao==="PARÇA"?C.verde:C.vermelho, fontWeight:600 }}>{r.validacao}</td>
                    <td style={{ padding:"4px 6px", textAlign:"right", fontWeight:600 }}>{r.abrangencia}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, valor, cor, sub }) {
  return (
    <div style={{ background:C.cinzaCard, border:`1px solid ${C.cinzaBorda}`, borderRadius:12, padding:16 }}>
      <div style={{ fontSize:12, color:C.cinzaTexto, marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:700, color:cor||C.texto }}>{valor}</div>
      {sub && <div style={{ fontSize:11, color:C.cinzaTexto, marginTop:2 }}>{sub}</div>}
    </div>
  );
}
function Legenda({ cor, texto }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:5 }}>
      <div style={{ width:12, height:12, borderRadius:3, background:cor }} />
      {texto}
    </div>
  );
}
function TabelaSimples({ titulo, linhas }) {
  return (
    <div style={{ marginTop:16 }}>
      <div style={{ fontWeight:700, marginBottom:8, fontSize:13 }}>{titulo} ({linhas.length})</div>
      <table style={{ width:"100%", fontSize:12, borderCollapse:"collapse" }}>
        <thead>
          <tr style={{ textAlign:"left", color:C.cinzaTexto }}>
            <th style={{ padding:"4px 6px" }}>Estado</th>
            <th style={{ padding:"4px 6px" }}>Cidade</th>
            <th style={{ padding:"4px 6px" }}>Transportadora</th>
            <th style={{ padding:"4px 6px" }}>Validação</th>
            <th style={{ padding:"4px 6px", textAlign:"right" }}>Abrangência</th>
          </tr>
        </thead>
        <tbody>
          {linhas.slice(0,200).map((r,i)=>(
            <tr key={i} style={{ borderTop:`1px solid ${C.cinzaBorda}` }}>
              <td style={{ padding:"4px 6px" }}>{r.estado}</td>
              <td style={{ padding:"4px 6px" }}>{r.cidade}</td>
              <td style={{ padding:"4px 6px" }}>{r.transportadora}</td>
              <td style={{ padding:"4px 6px", color:r.validacao==="PARÇA"?C.verde:C.vermelho, fontWeight:600 }}>{r.validacao}</td>
              <td style={{ padding:"4px 6px", textAlign:"right" }}>{r.abrangencia}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {linhas.length>200 && <div style={{ fontSize:11, color:C.cinzaTexto, marginTop:6 }}>Mostrando as 200 primeiras de {linhas.length}.</div>}
    </div>
  );
}
