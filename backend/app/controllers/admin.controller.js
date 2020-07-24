let Onesignal = require('onesignal-node');
const cron = require('node-cron');
const moment = require('moment');
var rp = require("promise-request-retry");

var gateway = require('../components/gateway.component.js');

async function getMyPermissions(reqObj) {
	let bearer = reqObj.bearer;
	delete reqObj.bearer;
	// let permissions = await gateway.getWithAuth('/admin/masters/auth-role-permission/list/' + reqObj.role_id);
	let permissions = await gateway.getWithAuth('/admin/masters/auth-role-permissions/list/' + reqObj.role_id, reqObj, bearer);

	return permissions;
};

function makeFileNameUnique(fileAbsPath, orginalPath, index) {
	const fs = require("fs");
	if (!fileAbsPath) return fileAbsPath;
	orginalPath = orginalPath ? orginalPath : fileAbsPath;
	if (!fs.existsSync(fileAbsPath)) {
		//console.log("File "+fileAbsPath+" does not exist. No renaming needed");
		return fileAbsPath;
	} else {
		index = index ? index : 0;
		index++;
		var fileAbsPathParts = orginalPath.split(".");
		var positionToModify = fileAbsPathParts.length - 2;
		if (fileAbsPathParts.length == 1) {
			positionToModify = 0;
		}
		fileAbsPathParts[positionToModify] += "-" + index;
		fileAbsPath = fileAbsPathParts.join(".");
		return makeFileNameUnique(fileAbsPath, orginalPath, index);
	}
}

function chkNullDate(x, res) {
	var regEx = /^\d{4}-\d{2}-\d{2}$/;
	let value = x.match(regEx) != null;
	if (!value) {
		return res.send({
			success: 0,
			message: ` Date format should be in 'yyyy-mm-dd' .  `
		})
	}
}
async function checkPermission(userId, User, AuthRolePermission, AuthPermission, permissionName, cb) {
	let value = false;

	let whereCondition = {
		status: 1,
		id: userId
	}

	let permissionCondition = {
		status: 1,
		permission: permissionName
	}

	let userCheck = await User.findOne({
		where: whereCondition,
		include: [{
			required: true,
			model: AuthRolePermission,
			as: 'rolepermission',
			include: [{
				required: true,
				model: AuthPermission,
				as: 'permission',
				where: permissionCondition
			}]
		}]
	}).catch(err => {
		console.log(err)
	})
	if (userCheck || (userCheck != null)) {
		value = true;
		return cb(value);
	}
	return cb(value);
}

async function getRecordsWithParentCatId(categoryId, CategoryRelationship, Category) {

	let records = await CategoryRelationship.findAll({
		where: {
			status: 1,
			parent_cat_id: categoryId
		},
		// attributes:['id','child_cat_id','parent_cat_id'],
		include: [{
			model: Category,
			as: 'child_category',
			where: {
				status: 1
			}
		}]
	}).catch(err => {
		console.log('err on line : 78 ' + err);
		return {
			success: 0,
			message: 'error on finding Records With ParentCatId ',
			err: err
		}
	})
	let result = records;


	return result;



}
async function getCountForCategoryRelationshipIds(categoryRelationshipIds, FacilitySurvey, Lsgi, Sequelize, facWhereCondition, lsgicon) {


	facWhereCondition.status = 1;
	if (categoryRelationshipIds.length <= 1) {
		facWhereCondition.category_relationship_id = categoryRelationshipIds[0];
	} else {
		facWhereCondition.category_relationship_id = {
			[Sequelize.Op.in]: categoryRelationshipIds
		}
	}

	let record = await FacilitySurvey.findOne({
		where: facWhereCondition,
		attributes: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'count']]
		//, include:[
		// 	{	model:Lsgi,
		// 		attributes:['lsgi_type_id'],
		// 		where:lsgicon
		// 	}
		// ]
	}).catch(err => console.log(err));
	record = record ? JSON.stringify(record) : null;
	record = record ? JSON.parse(record) : null;


	var count = record != null ? record.count : 0;



	return record ? record.count : 0;
}
async function getCountForFacilityTypeIds(categoryRelationshipIds, FacilitySurvey, Sequelize, facWhereCondition) {


	facWhereCondition.status = 1;
	if (categoryRelationshipIds.length <= 1) {
		facWhereCondition.facility_type_id = categoryRelationshipIds[0];
	} else {
		facWhereCondition.facility_type_id = {
			[Sequelize.Op.in]: categoryRelationshipIds
		}
	}

	let record = await FacilitySurvey.findOne({
		where: facWhereCondition,
		attributes: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'count']]

	}).catch(err => console.log(err));
	record = record ? JSON.stringify(record) : null;
	record = record ? JSON.parse(record) : null;


	return record ? record.count : 0;
}
async function calculateCount(catId, category_relationship_id, CategoryRelationship, FacilitySurvey, Lsgi, Sequelize, Category, facWhereCondition, lsgicon) {

	var endLevelCatRelationsIds = await getEndrelationshipIds(catId, category_relationship_id, CategoryRelationship, null, Category)


	return await getCountForCategoryRelationshipIds(endLevelCatRelationsIds, FacilitySurvey, Lsgi, Sequelize, facWhereCondition, lsgicon)
}


async function getEndrelationshipIds(categoryId, category_relationship_id, CategoryRelationship, endIds, Category) {



	let records = await getRecordsWithParentCatId(categoryId, CategoryRelationship, Category);



	if (!records.length) {

		let res = [category_relationship_id];

		return res;
	}
	endIds = endIds ? endIds : [];

	for (let i = 0; i < records.length; i++) {

		let childCatId = records[i].child_cat_id;

		if (!childCatId) continue;
		let categoryRelationshipId = records[i].id;


		if (endIds.includes(categoryRelationshipId)) continue;
		let newEndIds = await getEndrelationshipIds(childCatId, categoryRelationshipId, CategoryRelationship, endIds, Category);

		endIds = endIds.concat(newEndIds);
	}


	const unique = [...new Set(endIds)]


	return unique;
}
// }

function adminController(methods, options) {
	const that = this;
	const District = methods.loadModel('district');
	const IdGenerator = methods.loadModel('idGenerator');
	const QuestionOperation = methods.loadModel('questionOperation');
	const QuestionOperand = methods.loadModel('questionOperand');
	const LsgiType = methods.loadModel('lsgiType');
	const Lsgi = methods.loadModel('lsgi');
	const Ward = methods.loadModel('ward');
	const Category = methods.loadModel('category');
	const CategoryRelationship = methods.loadModel('categoryRelationship');
	const Meta = methods.loadModel('meta');
	const User = methods.loadModel('user');
	const GradeConfiguaration = methods.loadModel('gradeConfiguaration');
	const PercentageConfiguaration = methods.loadModel('percentageConfiguaration');
	const PercentageConfigSlab = methods.loadModel('percentageConfiguarationSlab');
	const Notification = methods.loadModel('notification');
	const SidebarMenu = methods.loadModel('sidebarMenu');
	const Question = methods.loadModel('question');
	const QuestionOption = methods.loadModel('questionOption');
	const QuestionGroup = methods.loadModel('questionGroup');
	const FacilityType = methods.loadModel('facilityType');
	const FacilitySurveyQuestion = methods.loadModel('facilitySurveyQuestion');
	const FacilitySurveyQuestionOption = methods.loadModel('facilitySurveyQuestionOption');
	const CategoryFacilitySurveyQuestion = methods.loadModel('categoryFacilitySurveyQuestion');
	const FacilitySurvey = methods.loadModel('facilitySurvey');
	const Image = methods.loadModel('image');
	const FacilitySurveyImage = methods.loadModel('facilitySurveyImage');
	const MainSurveyMasterQuestion = methods.loadModel('mainSurveyMasterQuestion');
	const Version = methods.loadModel('version');
	const AuthController = methods.loadModel('authController');
	const AuthPermission = methods.loadModel('authPermission');
	const AuthRole = methods.loadModel('authRole');
	const Survey = methods.loadModel('survey');
	const SurveyAnswer = methods.loadModel('surveyAnswer');
	const AuthRolePermission = methods.loadModel("authRolePermission");
	const AuthPermissionSidebarMenu = methods.loadModel("authPermissionSidebarMenu");
	const FieldName = methods.loadModel("fieldName");
	const UserType = methods.loadModel("userType");
	const LsgiBlock = methods.loadModel("lsgiBlock");
	const OfficeType = methods.loadModel("officeType");
	const Settings = methods.loadModel("settings");
	const Label = methods.loadModel("labels");
	const RoleHierarchy = methods.loadModel("roleHierarchy");
	const Otp = methods.loadModel('otp');
	const TargetMapping = methods.loadModel('targetMapping');
	const SurveyHistory = methods.loadModel('surveyHistory');
	const SurveyAnswerHistory = methods.loadModel('surveyAnswerHistory');
	const SettingsHistory = methods.loadModel('settingsHistory');

	const NotificationHistory = methods.loadModel('notificationHistory');



	var config = require('../../config/app.config.js');
	const profileConfig = config.profile;
	const onesignalConfig = config.onesignal;
	var paramsConfig = require('../../config/params.config');
	const JWT_KEY = paramsConfig.development.jwt.secret;
	const jwt = require('jsonwebtoken');

	var smsConfig = config.sms;
	var msg91 = require("msg91")(smsConfig.key, smsConfig.fromNo, smsConfig.route);
	var otpConfig = config.otp;

	const constants = require("../helpers/constants")
	const Sequelize = require('sequelize');
	const Op = Sequelize.Op;
	var bcrypt = require('bcryptjs');
	const salt = bcrypt.genSaltSync(10);


	this.getMulter = (multer) => {
		let path = profileConfig.uploadPath;
		path += path.endsWith("/") ? "" : "/";
		const storage = multer.diskStorage({
			destination: function (req, file, cb) {
				cb(null, path)
			},
			filename: function (req, file, cb) {
				let imagePath = path + file.originalname;
				console.log("first")
				let imageName = makeFileNameUnique(imagePath);


				imageName = imageName.replace(path, "");
				console.log("image name is" + imageName)
				cb(null, imageName)
			}

		})

		var upload = multer({ storage: storage })
		//   upload = upload.array('image');
		upload = upload.single('image');
		// multiUpload = upload.arrays('image');
		return upload;
		// return upload.array('image'); 
	},

	this.test =async (req,res)=>{

	},
	this.startCron = async () =>{
		
		let update = {};
		let Surveyupdate = {};
    //cron
			cron.schedule('0 0 * * *', async () => {
				console.log('***********************running the scheduled job');
				let idData = await Settings.findOne({
					where: {
						id: 1
					}
				})
				// console.log("json string***************"+JSON.stringify(idData.resurvey_period_days));
				let resurveyPeriod = idData.resurvey_period_days;
				let surveyClosingDate = idData.survey_closing_date;
				 let currentDate = moment().format('YYYY-MM-DD');


				console.log("json string resurveyPeriod***************"+JSON.stringify(resurveyPeriod));
				console.log("json string surveyClosingDate***************"+JSON.stringify(surveyClosingDate));
				//  console.log("json string changedDate***************"+JSON.stringify(changedDate));
				 
				 console.log("json string currentDate***************"+JSON.stringify(currentDate));

				 if(surveyClosingDate < currentDate ) {
					let resurveyPeriodExtend = moment(currentDate).add(resurveyPeriod, 'M').format('YYYY-MM-DD');
					// let resurveyPeriodExtenddate = moment(resurveyPeriodExtend).format('YYYY-MM-DD');
					console.log("json string futureMonth***************"+JSON.stringify(resurveyPeriodExtend));
					// console.log("json string resurveyPeriodExtenddate***************"+JSON.stringify(resurveyPeriodExtenddate));
					update.survey_closing_date = resurveyPeriodExtend;
					// Update Survey with new Survey Closing date
					await Settings.update(update, {
						where: {
							id: 1
						}
					})
					// update.is_active = 0;
					Surveyupdate.is_active = 0;
					
					await Survey.update(Surveyupdate, {
						where: {
							is_active: 1
						}
					})
					let email = "cron@suchitwa.mission.com";
					let cronData = await User.findOne({
						where: {
							email: email
						}
					})
					update.settings_id = idData.id;
					update.user_id = cronData.id;
					update.default_pagination_limit = idData.default_pagination_limit;
					update.about_content = idData.about_content;
					update.resurvey_period_days = resurveyPeriod;
					update.about_content = idData.about_content;
					// console.log("email id******************"+JSON.stringify(update));
					  await SettingsHistory.create(update);
				}
			  });
	},
	
	this.createDistrict = async (req, res) => {
		let params = req.body;

			if (!params.name_ml || !params.name_en) {
				var errors = [];

				if (!params.name_ml) {
					errors.push({
						field: "name_ml",
						message: 'Require district Malayalam name'

					});
				}
				if (!params.name_en) {
					errors.push({
						field: "name_en",
						message: 'Require district English name'
					});
				}

				return res.send({
					success: 0,
					statusCode: 400,
					errors: errors,
				});
			};


			let districtObj = {
				name_ml: params.name_ml.trim(),
				name_en: params.name_en.trim(),
				status: 1
			}
			let nameMlCheck = await District.findOne({
				where: {
					name_ml: params.name_ml.trim(),
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking malayalam district name exists or not',
						error: err
					})
				})
			if (nameMlCheck) {
				return res.send({
					success: 0,
					message: 'District malayalam name already exists..'
				})
			}

			let nameEnCheck = await District.findOne({
				where: {
					name_en: params.name_en.trim(),
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking english district name exists or not',
						error: err
					})
				})
			if (nameEnCheck) {
				return res.send({
					success: 0,
					message: 'District english name already exists..'
				})
			}
			try {
				let data = await District.create(districtObj);

				res.status(200).send({
					success: 1,
					id: data.dataValues.id,
					message: "District created successfully."
				});
			} catch (err) {
				console.log(err);
				return res.send({
					success: 0,
					message: 'Error while create a district'
				})
			}
		},
		this.updateDistrict = async (req, res) => {
			let districtId = req.params.id;
			let update = {};
			update.modified_at = new Date();
			update.status = 1;
			if (!req.body.name_ml && !req.body.name_en) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}
			if (req.body.name_ml) {
				update.name_ml = req.body.name_ml.trim();
			}
			if (req.body.name_en) {
				update.name_en = req.body.name_en.trim();
			}
			let idData = await District.findOne({
				where: {
					id: districtId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking district id exists or not',
						error: err
					})
				})
			if (!idData) {
				return res.send({
					success: 0,
					message: 'Invalid district '
				})
			} else {
				if (req.body.name_en) {
					let districtData = await District.findOne({
						where: {
							name_en: req.body.name_en.trim(),
							status: 1,
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking English district name already exists or not',
								error: err
							})
						})
					if (districtData && (districtData.id !== districtId)) {
						return res.send({
							success: 0,
							message: 'District English name already exists '
						})
					}
				}

				if (req.body.name_ml) {
					let districtData = await District.findOne({
						where: {
							name_ml: req.body.name_ml.trim(),
							status: 1,
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking malayalam district name already exists or not',
								error: err
							})
						})
					if (districtData && (districtData.id !== districtId)) {
						return res.send({
							success: 0,
							message: 'District Malayalam name already exists '
						})
					}
				}

				await District.update(update, {
					where: {
						id: districtId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating district name',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "District name updated successfully."
				});
			}


		},
		this.listDistrict = async (req, res) => {
			let params = req.query;
			let page = params.page;
			let perPage = Number(params.per_page);
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			if (params.keyword) {
				let name_en = {
					[Op.like]: '%' + params.keyword + '%',
				};
				let name_ml = {
					[Op.like]: '%' + params.keyword + '%'
				};
				whereCondition = Sequelize.or({ name_en }, { name_ml })
			}
			if (params.name) {
				let name_en = {
					[Op.like]: '%' + params.name + '%',
				};
				let name_ml = {
					[Op.like]: '%' + params.name + '%'
				};
				whereCondition = Sequelize.or({ name_en }, { name_ml })
			}


			let userDataz = req.identity.data;
			if (userDataz.district_id && userDataz.district_id != null) {
				whereCondition.id = userDataz.district_id;
			}
			// if(userDataz.lsgi_id && userDataz.lsgi_id!=null){
			// 	whereCondition.lsgi_id=userDataz.lsgi_id;
			// }
			// if(userDataz.lsgi_block_id && userDataz.lsgi_block_id!=null){
			// 	whereCondition.lsgi_block_id=userDataz.lsgi_block_id;
			// }
			// if(userDataz.ward_id && userDataz.ward_id!=null){
			// 	whereCondition.ward_id=userDataz.ward_id;
			// }
			whereCondition.status = 1;
			let objDistrict = {
				order: [
					['modified_at', 'DESC']
				],
				where: whereCondition,
			}

			if (params.per_page) {
				objDistrict.limit = perPage;
			}
			if (page && params.per_page) {
				objDistrict.offset = offset;
				objDistrict.limit = perPage;
			}
			var districts = await District.findAll(objDistrict)
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching districts data',
						error: err
					})
				});

			var count = await District.count({
				where: whereCondition,

			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching district count data',
						error: err
					})
				});

			let totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: districts,
				total_items: count,
				total_pages: totalPages,
				page,
				per_page: perPage,
				has_next_page: hasNextPage,
				message: "Districts listed successfully",
				success: 1,
			}
			return res.send(response);
		},


		this.getDistrict = async (req, res) => {
			let districtId = req.params.id;
			let districtData = await District.findOne({
				where: {
					id: districtId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting district data',
						error: err
					})
				})
			let response = {
				district: districtData,
				success: 1,
			}
			return res.send(response);
		},
		this.deleteDistrict = async (req, res) => {
			let districtId = req.params.id;
			let districtData = await District.findOne({
				where: {
					id: districtId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting district data',
						error: err
					})
				})
			if (districtData) {
				let update = {
					status: 0
				}
				await District.update(update, {
					where: {
						id: districtData.id

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while deleting district',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "District deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "District not exists."
				});
			}


		},

		this.createLsgiType = async (req, res) => {
			let params = req.body;
			if (!params.name_ml || !params.name_en) {
				var errors = [];

				if (!params.name_ml) {
					errors.push({
						field: "name_ml",
						message: 'Require lsgi type Malayalam name'

					});
				}
				if (!params.name_en) {
					errors.push({
						field: "name_en",
						message: 'Require lsgi type English name'
					});
				}

				return res.send({
					success: 0,
					statusCode: 400,
					errors: errors,
				});
			};

			if (!params.show_block_panchayath) {
				params.show_block_panchayath = 0;
			}



			let lsgiTypeObj = {
				name_ml: params.name_ml.trim(),
				name_en: params.name_en.trim(),
				show_block_panchayath: params.show_block_panchayath,
				status: 1
			}
			let nameMlCheck = await LsgiType.findOne({
				where: {
					name_ml: lsgiTypeObj.name_ml,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching LSGI Type',
						error: err
					})
				})
			if (nameMlCheck) {
				return res.send({
					success: 0,
					message: 'LSGI Type name in Malayalam already exists',
					error: err
				})
			}
			let nameEnCheck = await LsgiType.findOne({
				where: {
					name_en: lsgiTypeObj.name_en,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching LSGI Type',
						error: err
					})
				})
			if (nameEnCheck) {
				return res.send({
					success: 0,
					message: 'LSGI Type name in English already exists',
					error: err
				})
			}

			try {
				let data = await LsgiType.create(lsgiTypeObj);
				res.status(200).send({
					success: 1,
					id: data.dataValues.id,
					message: "LSGI Type created successfully."
				});
			} catch (err) {
				console.log(err);
				return res.send({
					success: 0,
					message: 'Error while create a lsgi type'
				})
			}
		},

		this.updateLsgiType = async (req, res) => {
			let lsgiTypeId = req.params.id;
			let update = {};
			update.modified_at = new Date();

			if (!req.body.name_ml && !req.body.name_en && !req.body.show_block_panchayath) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}
			if (req.body.name_ml) {
				update.name_ml = req.body.name_ml.trim();
			}
			if (req.body.name_en) {
				update.name_en = req.body.name_en.trim();
			}
			if (req.body.show_block_panchayath) {
				update.show_block_panchayath = req.body.show_block_panchayath;
			}
			let idData = await LsgiType.findOne({
				where: {
					id: lsgiTypeId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking lsgi type id exists or not',
						error: err
					})
				})
			if (!idData) {
				return res.send({
					success: 0,
					message: 'Invalid district '
				})
			} else {
				let lsgiTypeData = await LsgiType.findOne({
					where: {
						name_en: req.body.name_en,
						status: 1,
					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while checking lsgi type name already exists or not',
							error: err
						})
					})
				if (lsgiTypeData && (lsgiTypeData.id !== lsgiTypeId)) {
					return res.send({
						success: 0,
						message: 'lsgiType name already exists '
					})
				} else {

					await LsgiType.update(update, {
						where: {
							id: lsgiTypeId

						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while updating Lsgitype name',
								error: err
							})
						})
					res.status(200).send({
						success: 1,
						message: "Lsgitype name updated successfully."
					});
				}

			}
		},

		this.getLsgiType = async (req, res) => {
			let lsgiTypeId = req.params.id;
			let lsgiTypeObj = await LsgiType.findOne({
				where: {
					id: lsgiTypeId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting lsgi type data',
						error: err
					})
				})
			let response = {
				lsgiType: lsgiTypeObj,
				success: 1,
			}
			res.send(response);
		},

		this.listLsgiType = async (req, res) => {
			let params = req.query;
			let page = params.page;
			let perPage = Number(params.per_page);
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			if (params.name) {
				let name_en = {
					[Op.like]: '%' + params.name + '%',
				};
				let name_ml = {
					[Op.like]: '%' + params.name + '%'
				};
				whereCondition = Sequelize.or({ name_en }, { name_ml })
			}
			if (params.keyword) {
				let name_en = {
					[Op.like]: '%' + params.keyword + '%',
				};
				let name_ml = {
					[Op.like]: '%' + params.keyword + '%'
				};
				whereCondition = Sequelize.or({ name_en }, { name_ml })
			}
			whereCondition.status = 1;
			let objLsgiType = {
				raw: true,
				order: [
					['modified_at', 'DESC']
				],
				where: whereCondition
			}

			if (params.per_page) {
				objLsgiType.limit = perPage;
			}
			if (page && params.per_page) {
				objLsgiType.offset = offset;
				objLsgiType.limit = perPage;
			}

			var lsgiTypes = await LsgiType.findAll(objLsgiType)
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching lsgi types data',
						error: err
					})
				});

			var count = await LsgiType.count({
				where: {
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching lsgi types count data',
						error: err
					})
				});

			let totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: lsgiTypes,
				total_items: count,
				has_next_page: hasNextPage,
				total_pages: totalPages,
				page,
				per_page: perPage,
				message: "Lsgi types listed successfully",
				success: 1,
			}
			res.send(response);
		},


		this.deleteLsgiType = async (req, res) => {
			let lsgiTypeId = req.params.id;
			let lsgiTypeData = await LsgiType.findOne({
				where: {
					id: lsgiTypeId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting lsgi type data',
						error: err
					})
				})
			if (lsgiTypeData) {
				let update = {
					status: 0
				}
				await LsgiType.update(update, {
					where: {
						id: lsgiTypeData.id

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating lsgi type name',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Lsgi type" + lsgiTypeData.name + " deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "Lsgi type not exists."
				});
			}


		},


		this.createLsgi = async (req, res) => {
			let params = req.body;
			if (!params.name_ml || !params.name_en || !params.district_id ||
				!params.lsgi_type_id) {
				var errors = [];

				if (!params.name_ml) {
					errors.push({
						field: "name_ml",
						message: 'Require lsgi Malayalam name'

					});
				}
				if (!params.name_en) {
					errors.push({
						field: "name_en",
						message: 'Require lsgi English name'
					});
				}
				if (!params.lsgi_type_id) {
					errors.push({
						success: 0,
						message: 'Require lsgi type id'
					})
				}
				if (!params.district_id) {
					errors.push({
						field: "name_en",
						message: 'Require lsgi district id'
					});
				}

				return res.send({
					success: 0,
					statusCode: 400,
					errors: errors,
				});
			};

			let lsgiObj = {
				name_ml: params.name_ml.trim(),
				name_en: params.name_en.trim(),
				district_id: params.district_id,
				lsgi_type_id: params.lsgi_type_id,
				status: 1
			}
			if (params.lsgi_block_id) {
				lsgiObj.lsgi_block_id = params.lsgi_block_id;
			}
			let lsgiEnData = await Lsgi.findOne({
				where: {
					district_id: params.district_id,
					name_en: lsgiObj.name_en,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking lsgi already exists ornot',
						error: err
					})
				})
			if (lsgiEnData) {
				return res.send({
					success: 0,
					message: 'Lsgi already exist in district'
				})
			}
			let lsgiMlData = await Lsgi.findOne({
				where: {
					district_id: params.district_id,
					name_en: lsgiObj.name_ml,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking lsgi already exists ornot',
						error: err
					})
				})
			if (lsgiMlData) {
				return res.send({
					success: 0,
					message: 'Lsgi already exist in district'
				})
			}
			try {
				let data = await Lsgi.create(lsgiObj);
				res.status(200).send({
					success: 1,
					id: data.dataValues.id,
					message: "lsgi created successfully."
				});
			} catch (err) {
				console.log(err);
				return res.send({
					success: 0,
					message: 'Error while create a lsgi'
				})
			}
		},


		this.updateLsgi = async (req, res) => {
			let lsgiId = req.params.id;
			let update = {};
			update.modified_at = new Date();
			update.status = 1;
			if (!req.body.name_ml && !req.body.name_en &&
				!req.body.district_id && !req.body.lsgi_type_id &&
				!req.body.lsgi_block_id) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}
			if (req.body.name_ml) {
				update.name_ml = req.body.name_ml.trim();
			}
			if (req.body.name_en) {
				update.name_en = req.body.name_en.trim();
			}
			if (req.body.district_id) {
				update.district_id = req.body.district_id;
			}
			if (req.body.lsgi_type_id) {
				update.lsgi_type_id = req.body.lsgi_type_id;
			}
			if (req.body.lsgi_block_id) {
				update.lsgi_block_id = req.body.lsgi_block_id;
			}
			let idData = await Lsgi.findOne({
				where: {
					id: lsgiId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking lsgi id exists or not',
						error: err
					})
				})
			if (!idData) {
				return res.send({
					success: 0,
					message: 'Invalid lsgi '
				})
			} else {
				if (req.body.name_en) {
					let lsgiData = await Lsgi.findOne({
						where: {
							name_en: req.body.name_en,
							status: 1,
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking lsgi name already exists or not',
								error: err
							})
						})
					if (lsgiData && (lsgiData.name_en !== idData.name_en)) {
						return res.send({
							success: 0,
							message: 'Lsgi name already exists '
						})
					}
				}

				await Lsgi.update(update, {
					where: {
						id: lsgiId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating lsgi name',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Lsgi updated successfully."
				});
			}


		},

		this.checkPermissions = async (req, res) => {
			let user = req.identity.data;
			let userId = user.id;
			let data = {
				user_id: userId,
				permission_name: req.params.permission
			}
			checkPermission(userId, User, AuthRolePermission, AuthPermission, data.permission_name, (value) => {
				data.is_permission = value;
				return res.send(data)
			})
		}
		,
		this.listLsgi = async (req, res) => {
			let params = req.query;
			let page = params.page;
			let perPage = Number(params.per_page);
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			if (params.keyword) {
				let name_en = {
					[Op.like]: '%' + params.keyword + '%',
				};
				let name_ml = {
					[Op.like]: '%' + params.keyword + '%'
				};
				whereCondition = Sequelize.or({ name_en }, { name_ml })
			}
			if (params.name) {
				let name_en = {
					[Op.like]: '%' + params.name + '%',
				};
				let name_ml = {
					[Op.like]: '%' + params.name + '%'
				};
				whereCondition = Sequelize.or({ name_en }, { name_ml })
			}

			if (params.district_id) {
				whereCondition.district_id = params.district_id
			}
			if (params.lsgi_type_id) {
				whereCondition.lsgi_type_id = params.lsgi_type_id
			}
			if (params.lsgi_block_id) {
				whereCondition.lsgi_block_id = params.lsgi_block_id
			}

			let userDataz = req.identity.data;
			if (userDataz.district_id && userDataz.district_id != null) {
				whereCondition.district_id = userDataz.district_id;
			}
			if (userDataz.lsgi_id && userDataz.lsgi_id != null) {
				whereCondition.id = userDataz.lsgi_id;
			}
			if (userDataz.lsgi_block_id && userDataz.lsgi_block_id != null) {
				whereCondition.lsgi_block_id = userDataz.lsgi_block_id;
			}
			// if(userDataz.ward_id && userDataz.ward_id!=null){
			// 	whereCondition.ward_id=userDataz.ward_id;
			// }
			whereCondition.status = 1;
			let objLsgi = {
				// raw: true,
				order: [
					['modified_at', 'DESC']
				],
				where: whereCondition,
				include: [{
					model: LsgiType,
				}, {
					model: District
				}, {
					model: LsgiBlock,
				}]

			}

			if (params.per_page) {
				objLsgi.limit = perPage;
			}
			if (page && params.per_page) {
				objLsgi.offset = offset;
				objLsgi.limit = perPage;
			}

			var lsgis = await Lsgi.findAll(objLsgi)
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching lsgi data',
						error: err
					})
				});

			var count = await Lsgi.count({
				where: whereCondition,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching lsgi data',
						error: err
					})
				});

			let totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: lsgis,
				total_items: count,
				has_next_page: hasNextPage,
				total_pages: totalPages,
				page,
				per_page: perPage,
				message: "Lsgi listed successfully",
				success: 1,
			}
			res.send(response);
		},

		this.getLsgi = async (req, res) => {
			let lsgiId = req.params.id;
			let lsgiObj = await Lsgi.findOne({
				where: {
					id: lsgiId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting lsgi data',
						error: err
					})
				})
			let response = {
				lsgi: lsgiObj,
				success: 1,
			}
			res.send(response);
		},

		this.deleteLsgi = async (req, res) => {
			let lsgiId = req.params.id;
			let lsgiData = await Lsgi.findOne({
				where: {
					id: lsgiId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting lsgi data',
						error: err
					})
				})
			if (lsgiData) {
				let update = {
					status: 0
				}
				await Lsgi.update(update, {
					where: {
						id: lsgiData.id

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating lsgi  name',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Lsgi deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "Lsgi  not exists."
				});
			}


		},

		this.createWard = async (req, res) => {
			let params = req.body;

			if (!params.name_ml || !params.name_en ||
				!params.lsgi_id || !params.ward_no) {
				var errors = [];

				if (!params.name_ml) {
					errors.push({
						field: "name_ml",
						message: 'Require ward Malayalam name'

					});
				}
				if (!params.name_en) {
					errors.push({
						field: "name_en",
						message: 'Require ward English name'
					});
				}
				if (!params.lsgi_id) {
					errors.push({
						success: 0,
						message: 'Require ward lsgi id'
					})
				}
				if (!params.ward_no) {
					errors.push({
						field: "ward_no",
						message: 'Require ward no'
					});
				}

				return res.send({
					success: 0,
					statusCode: 400,
					errors: errors,
				});
			};

			let wardObj = {
				name_en: params.name_en.trim(),
				name_ml: params.name_ml.trim(),
				ward_no: params.ward_no,
				lsgi_id: params.lsgi_id,
				status: 1
			}


			let lsgiData = await Lsgi.findOne({
				where: {
					id: params.lsgi_id,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking lsgi exists or not',
						error: err
					})
				})
			if (!lsgiData) {
				res.status(200).send({
					success: 1,
					message: "Invalid lsgi."
				});
			}


			let wardNoData = await Ward.findOne({
				where: {
					lsgi_id: params.lsgi_id,
					ward_no: params.ward_no,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking ward no already exists or not',
						error: err
					})
				})
			if (wardNoData) {
				res.status(200).send({
					success: 1,
					message: "ward no already exist in lsgi."
				});
			}

			let wardMlData = await Ward.findOne({
				where: {
					lsgi_id: params.lsgi_id,
					name_ml: params.name_ml,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking ward name in malayalam already exists or not',
						error: err
					})
				})
			if (wardMlData) {
				res.status(200).send({
					success: 1,
					message: "ward name in malayalam already exist in lsgi."
				});
			}

			let wardEnData = await Ward.findOne({
				where: {
					lsgi_id: params.lsgi_id,
					name_en: params.name_en,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking ward name in english already exists or not',
						error: err
					})
				})

			if (wardEnData) {
				res.status(200).send({
					success: 1,
					id: data.dataValues.id,
					message: "ward name in english already exist in lsgi."
				});
			}

			try {
				let data = await Ward.create(wardObj);
				res.status(200).send({
					success: 1,
					id: data.dataValues.id,
					message: "ward created successfully."
				});
			} catch (err) {
				console.log(err);
				return res.send({
					success: 0,
					message: 'Error while create a ward'
				})
			}
		},

		this.updateWard = async (req, res) => {
			let wardId = req.params.id;
			let update = {};
			update.modified_at = new Date();
			update.status = 1;
			if (!req.body.name_en && !req.body.name_ml
				&& !req.body.lsgi_id && !req.body.ward_no) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}
			if (req.body.name_ml) {
				update.name_ml = req.body.name_ml.trim();
			}
			if (req.body.name_en) {
				update.name_en = req.body.name_en.trim();
			}
			if (req.body.lsgi_id) {
				update.lsgi_id = req.body.lsgi_id;
			}
			if (req.body.ward_no) {
				update.ward_no = req.body.ward_no;
			}

			let idData = await Ward.findOne({
				where: {
					id: wardId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking ward id exists or not',
						error: err
					})
				})

			if (!idData) {
				return res.send({
					success: 0,
					message: 'Invalid ward '
				})
			}
			let lsgiId;
			if (req.body.lsgi_id) {
				update.lsgi_id = req.body.lsgi_id;
				let lsgi_id = req.body.lsgi_id;
				let lsgiData = await Lsgi.findOne({
					where: {
						id: req.body.lsgi_id,
						status: 1
					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while checking Ward  exists or not',
							error: err
						})
					})

				if (!lsgiData) {
					res.status(200).send({
						success: 1,
						message: "Invalid  Ward."
					});
				}
				lsgiId = lsgiData.id;
			}
			else {
				lsgiId = idData.lsgi_id;
			}
			if (req.body.name_en) {

				let wardData = await Ward.findOne({
					where: {
						name_en: req.body.name_en,
						lsgi_id: lsgiId,
						status: 1,
					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while checking ward name already exists or not',
							error: err
						})
					})


				if (wardData && (wardData.name_en !== idData.name_en)) {
					return res.send({
						success: 0,
						message: 'Ward name in English already exists '
					})
				}
			}
			if (req.body.ward_no) {

				let wardData = await Ward.findOne({
					where: {
						ward_no: req.body.ward_no,
						lsgi_id: lsgiId,
						status: 1,
					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while checking ward number already exists or not',
							error: err
						})
					})
				if (wardData && (wardData.id !== idData.id)) {
					return res.send({
						success: 0,
						message: 'Ward number already exists '
					})
				}
			}

			if (req.body.name_ml) {
				let wardData = await Ward.findOne({
					where: {
						name_ml: req.body.name_ml,
						lsgi_id: lsgiId,
						status: 1,
					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while checking ward name in Malayalam already exists or not',
							error: err
						})
					})
				if (wardData && (wardData.name_ml !== idData.name_ml)) {
					return res.send({
						success: 0,
						message: 'Ward name in Malayalam already exists '
					})
				}
			}


			await Ward.update(update, {
				where: {
					id: wardId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while updating Ward name',
						error: err
					})
				})
			res.status(200).send({
				success: 1,
				message: "Ward updated successfully."
			});
			// }


		},


		this.getWard = async (req, res) => {
			let wardId = req.params.id;
			let wardObj = await Ward.findOne({
				where: {
					id: wardId,
					status: 1
				},
				include: {
					model: Lsgi,
					as: "lsgi",
					where: { status: 1 }
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting ward data',
						error: err
					})
				})
			let response = {
				ward: wardObj,
				success: 1,
			}
			res.send(response);
		},

		this.listWard = async (req, res) => {
			let params = req.query;
			let page = params.page;
			let perPage = Number(params.per_page);
			var offset = (page - 1) * perPage;
			let whereCondition = {}
			if (params.keyword) {
				let name_en = {
					[Op.like]: '%' + params.keyword + '%',
				};
				let name_ml = {
					[Op.like]: '%' + params.keyword + '%'
				};
				whereCondition = Sequelize.or({ name_en }, { name_ml })
			}
			if (params.name) {
				let name_en = {
					[Op.like]: '%' + params.name + '%',
				};
				let name_ml = {
					[Op.like]: '%' + params.name + '%'
				};
				whereCondition = Sequelize.or({ name_en }, { name_ml })
			}
			if (params.lsgi_id) {
				whereCondition.lsgi_id = params.lsgi_id;
			}
			whereCondition.status = 1;
			let userDataz = req.identity.data;
			// if(userDataz.district_id && userDataz.district_id!=null){
			// 	whereCondition.district_id=userDataz.district_id;
			// }
			if (userDataz.lsgi_id && userDataz.lsgi_id != null) {
				whereCondition.lsgi_id = userDataz.lsgi_id;
			}
			// if(userDataz.lsgi_block_id && userDataz.lsgi_block_id!=null){
			// 	whereCondition.lsgi_block_id=userDataz.lsgi_block_id;
			// }
			if (userDataz.ward_id && userDataz.ward_id != null) {
				whereCondition.id = userDataz.ward_id;
			}
			let objWard = {
				order: [
					['ward_no', 'ASC']
				],
				include: [{
					model: Lsgi
				}],
				where: whereCondition
			}
			if (params.per_page) {
				objWard.limit = perPage;
			}
			if (page && params.per_page) {
				objWard.offset = offset;
				objWard.limit = perPage;
			}
			var wards = await Ward.findAll(objWard)
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching ward data',
						error: err
					})
				});

			var count = await Ward.count({
				where: whereCondition,

			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching ward data',
						error: err
					})
				});

			let totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: wards,
				total_items: count,
				total_pages: totalPages,
				page,
				per_page: perPage,
				has_next_page: hasNextPage,
				message: "Wards listed successfully",
				success: 1,
			}
			res.send(response);
		},


		this.deleteWard = async (req, res) => {
			let wardId = req.params.id;
			let wardData = await Ward.findOne({
				where: {
					id: wardId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting ward data',
						error: err
					})
				})
			if (wardData) {
				let update = {
					status: 0
				}
				await Ward.update(update, {
					where: {
						id: wardData.id

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating ward name',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Ward deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "Ward not exists."
				});
			}


		},
		this.handleImage = async (req, res) => {

			var image = req.file;
			if (image && image.filename) {
				image = image.filename;
				var imageObj = { name: image, status: 1 };
				let data = null;
				try {
					data = await Image.create(imageObj);
					let imageId = data.dataValues.id;
					return imageId;
				} catch (err) {
					console.log(err);
					return null;
				}
			}
		},
		this.createCategory = async (req, res) => {
			let params = req.body;

			if (!params.name_ml || !params.name_en || !params.children_page_layout) {
				var errors = [];
				var imageId = null;
				if (!params.name_ml) {
					errors.push({
						field: "name_ml",
						message: 'Require  Malayalam name'

					});
				}
				if (!params.name_en) {
					errors.push({
						field: "name_en",
						message: 'Require  English name'
					});
				}
				if (!params.children_page_layout) {
					errors.push({
						field: "children_page_layout",
						message: 'Require children page layout'
					})
				}
				return res.send({
					success: 0,
					statusCode: 400,
					errors: errors,
				});
			};
			var imageId = await that.handleImage(req, res);
			let categoryObj = {
				name_ml: params.name_ml.trim(),
				name_en: params.name_en.trim(),
				children_page_layout: params.children_page_layout.trim(),
				image_id: imageId,
				status: 1
			}
			try {
				let data = await Category.create(categoryObj);
				res.status(200).send({
					success: 1,
					id: data.dataValues.id,
					message: "Category created successfully."
				});
			} catch (err) {
				console.log(err);
				return res.send({
					success: 0,
					message: 'Error while creating category'
				})
			}
		}
	this.updateCategory = async (req, res) => {
		let categoryId = req.params.id;
		let imageId = null;
		let update = {};
		let params = req.body;

		update.modified_at = new Date();
		update.status = 1;


		if (!categoryId || !params.name_ml || !params.name_en || !params.children_page_layout) {
			return res.send({
				success: 0,
				message: 'All Fields are Mandatory to update(id,name_en,name_ml,children_page_layout)'
			})
		}
		if (params.name_ml) {
			update.name_ml = params.name_ml;
		}
		if (params.name_en) {
			update.name_en = params.name_en;
		}
		if (params.children_page_layout) {
			update.children_page_layout = params.children_page_layout;
		}
		var whereCondition = {
			status: 1,
			id: {
				$ne: categoryId
			}
		}
		if (params.name_en) {
			whereCondition.name_en = params.name_en;
		}
		if (params.name_en) {
			whereCondition.name_ml = params.name_ml;
		}
		let idData = await Category.findOne({
			where: {
				id: categoryId,
				status: 1
			}
		})
			.catch(err => {
				return res.send({
					success: 0,
					message: 'Something went wrong while checking category id exists or not',
					error: err
				})
			});

		if (!idData) {
			return res.send({
				success: 0,
				message: 'Invalid category '
			})
		} else {

			console.log(whereCondition)
			let categoryData = await Category.findOne({
				where: whereCondition
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking category name en , ml already exists or not',
						error: err
					})
				});
			if (categoryData) {
				return res.send({
					success: 0,
					message: 'Category name already exists '
				})
			}


			imageId = idData.image_id;

			var imgId = await that.handleImage(req, res);

			if (imgId && imgId != null) {
				imageId = imgId;
			}
			//imageId = imgId ? imgId : imageId;

			update.image_id = imageId;
			await Category.update(update, {
				where: {
					id: categoryId

				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while updating category',
						error: err
					})
				})
			res.status(200).send({
				success: 1,
				message: "Category updated successfully."
			});
		}


	},

		this.getCategory = async (req, res) => {
			let categoryId = req.params.id;
			let categoryObj = await Category.findOne({
				where: {
					id: categoryId,
					status: 1
				},
				include: [{
					model: Image
				}]
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting category data',
						error: err
					})
				})
			let response = {
				image_base: profileConfig.imageBase,
				category: categoryObj,
				success: 1,
			}
			res.send(response);
		},

		this.listCategory = async (req, res) => {
			let params = req.query;
		
			let page = params.page;
			let perPage = Number(params.per_page);
			var offset = (page - 1) * perPage;

			let whereCondition = {};
			if (params.keyword) {
				let name_en = {
					[Op.like]: '%' + params.keyword + '%',
				};
				let name_ml = {
					[Op.like]: '%' + params.keyword + '%'
				};
				whereCondition = Sequelize.or({ name_en }, { name_ml })
			}
			if (params.children_page_layout) {
				whereCondition.children_page_layout = params.children_page_layout
			}
			whereCondition.status = 1
			let objCategories = {
				order: [
					['modified_at', 'DESC']
				],
				include: [{
					model: Image
				}],
				where: whereCondition
			}

			if (params.per_page) {
				objCategories.limit = perPage;
			}
			if (page && params.per_page) {
				objCategories.offset = offset;
				objCategories.limit = perPage;
			}


			var categories = await Category.findAll(objCategories)
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching category data',
						error: err
					})
				});

			var count = await Category.count({
				where: whereCondition,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching category data',
						error: err
					})
				});

			let totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				image_base: profileConfig.imageBase,
				items: categories,
				total_items: count,
				has_next_page: hasNextPage,
				total_pages: totalPages,
				page,
				per_page: perPage,
				message: "Categories listed successfully",
				success: 1,
			}
			res.send(response);
		},

		this.deleteCategory = async (req, res) => {
			let categoryId = req.params.id;
			let categoryData = await Category.findOne({
				where: {
					id: categoryId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting category data',
						error: err
					})
				})
			if (categoryData) {
				let update = {
					status: 0
				}
				await Category.update(update, {
					where: {
						id: categoryData.id

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while deleting category',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Category deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "Category not exists."
				});
			}


		},
		this.createCategoryRelationship = async (req, res) => {
			let params = req.body;

			if (!params.parent_cat_id && !params.child_cat_id) {
				return res.send({
					success: 0,
					message: 'Atleast 1 category id '
				})
			}
			if (!params.sort_order) {
				return res.send({
					success: 0,
					message: 'Require sort order'
				})
			}

			let categoryRelationshipObj = {
				status: 1
			}
			if (params.parent_cat_id) {
				categoryRelationshipObj.parent_cat_id = params.parent_cat_id
			}
			if (params.child_cat_id) {
				categoryRelationshipObj.child_cat_id = params.child_cat_id
			}
			if (params.sort_order) {
				categoryRelationshipObj.sort_order = params.sort_order
			}
			try {
				let data = await CategoryRelationship.create(categoryRelationshipObj);
				res.status(200).send({
					success: 1,
					id: data.dataValues.id,
					message: "Category relationship created successfully."
				});
			} catch (err) {
				console.log(err);
				return res.send({
					success: 0,
					message: 'Error while create a category relationship'
				})
			}


		},
		this.updateCategoryRelationship = async (req, res) => {
			let categoryRelationshipId = req.params.id;
			let update = {};
			update.modified_at = new Date();
			update.status = 1;
			if (!req.body.parent_cat_id && !req.body.child_cat_id && !req.body.sort_order) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}
			if (req.body.parent_cat_id) {
				update.parent_cat_id = req.body.parent_cat_id;
			}
			if (req.body.child_cat_id) {
				update.child_cat_id = req.body.child_cat_id;
			}
			if (req.body.sort_order) {
				update.sort_order = req.body.sort_order;
			}

			let categoryRelationshipData = await CategoryRelationship.findOne({
				where: {
					id: categoryRelationshipId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking categoryRelationshipId exists or not',
						error: err
					})
				})
			if (!categoryRelationshipData) {
				return res.send({
					success: 0,
					message: 'Invalid categoryRelationship '
				})
			} else {

				await CategoryRelationship.update(update, {
					where: {
						id: categoryRelationshipId
					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating Category Relationship',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "CategoryRelationship updated successfully."
				});
			}


		},

		this.listCategoryReletionship = async (req, res) => {
			let params = req.query;

			let page = params.page;
			let perPage = Number(params.per_page);
			var offset = (page - 1) * perPage;

			let whereCondition = {
				status: 1
			}
			if (params.parent_cat_id) {
				whereCondition.parent_cat_id = params.parent_cat_id
			}
			if (params.child_cat_id) {
				whereCondition.child_cat_id = params.child_cat_id
			}
			if (params.sort_order) {
				whereCondition.sort_order = params.sort_order
			}
			if (params.keyword) {
				let name_en = {
					[Op.like]: '%' + params.keyword + '%',
				};
				let name_ml = {
					[Op.like]: '%' + params.keyword + '%'
				};
				whereCondition = Sequelize.or({ name_en }, { name_ml })
			}
			if(params.dropdown=="parent_cat_id"){
				whereCondition.parent_cat_id={
					[Sequelize.Op.not]: 'null'
				  }
			}
			let objCategories = {
				order: [
					['modified_at', 'DESC']
				],
				where: whereCondition,
				include: [{
					model: Category,
					as: 'parent_category'
				}, {
					model: Category,
					as: 'child_category'
				}],
			}

			if (params.per_page) {
				objCategories.limit = perPage;
			}
			if (page && params.per_page) {
				objCategories.offset = offset;
				objCategories.limit = perPage;
			}

			var categoryRelationshipData = await CategoryRelationship.findAll(objCategories)
			// .catch(err => {
			// 	return res.send({
			// 		success: 0,
			// 		message: 'Something went wrong while fetching category relationship data',
			// 		error: err
			// 	})
			// });

			var count = await CategoryRelationship.count({
				where: whereCondition,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching category relationship data',
						error: err
					})
				});
				let datasForDropdown=[];
				if(params.dropdown=="parent_cat_id"){
						
					function removeDuplicates(originalArray, prop) {
						 var newArray = [];
						 var lookupObject  = {};
					
						 for(var i in originalArray) {
							lookupObject[originalArray[i][prop]] = originalArray[i];
						 }
					
						 for(i in lookupObject) {
							 newArray.push(lookupObject[i]);
						 }
						  return newArray;
					 }
					
					var categoryRelationshipData = removeDuplicates(categoryRelationshipData, "parent_cat_id");
					
					categoryRelationshipData.map(item=>{
						let obj={id:item.parent_cat_id,
						name_en:item.parent_category.name_en
					}
					datasForDropdown.push(obj);
					})
				}

			totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: categoryRelationshipData,
				total_items: count,
				has_next_page: hasNextPage,
				total_pages: totalPages,
				page,
				per_page: perPage,
				message: "categoryRelationship listed successfully",
				success: 1,
			}
			if(params.dropdown=="parent_cat_id"){
				response.items=datasForDropdown
			}
			res.send(response);
		},

		this.getCategoryRelationship = async (req, res) => {
			let categoryRelationshipId = req.params.id;
			let categoryRelationshipObj = await CategoryRelationship.findOne({
				where: {
					id: categoryRelationshipId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting category relationship data',
						error: err
					})
				})
			let response = {
				categoryRelationship: categoryRelationshipObj,
				success: 1,
			}
			res.send(response);
		},

		this.deleteCategoryRelationship = async (req, res) => {
			let categoryRelationshipId = req.params.id;
			let categoryRelationshipData = await CategoryRelationship.findOne({
				where: {
					id: categoryRelationshipId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while deleting category relationship data',
						error: err
					})
				})
			if (categoryRelationshipData) {
				let update = {
					status: 0
				}
				await CategoryRelationship.update(update, {
					where: {
						id: categoryRelationshipData.id

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while deleting category relationship',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Category Relationship deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "Category Relationship not exists."
				});
			}


		},

		this.createMeta = async (req, res) => {
			let params = req.body;

			if (!params.key || !params.value || !params.flag) {
				var errors = [];
				if (!params.key) {
					errors.push({
						field: "key",
						message: "key is missing"
					});
				}
				if (!value) {
					errors.push({
						field: "value",
						message: "value is missing"
					});
				}
				if (!flag) {
					errors.push({
						field: "flag",
						message: "flag is missing"
					});
				}
				return res.status(200).send({
					success: 0,
					errors: errors,
					code: 200
				});
			}

			let metaObj = {
				status: 1
			}
			if (params.key) {
				metaObj.key = params.key
			}
			if (params.value) {
				metaObj.value = params.value
			}
			if (params.flag) {
				metaObj.flag = params.flag
			}

			let metaData = await Meta.findOne({
				key: params.key,
				value: params.value,
				status: 1
			})
			if (metaData != null) {
				try {
					let data = await Meta.create(metaObj);
					res.status(200).send({
						success: 1,
						id: data.dataValues.id,
						message: "Meta created successfully."
					});
				} catch (err) {
					console.log(err);
					return res.send({
						success: 0,
						message: 'Error while create a meta'
					})
				}
			} else {
				return res.send({
					success: 0,
					message: 'Already exists'
				})
			}
		},


		this.updateMeta = async (req, res) => {
			let metaId = req.params.id;
			let update = {};
			update.status = 1;
			update.modified_at = new Date();
			if (!req.body.key && !req.body.value && !req.body.value) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}
			if (req.body.key) {
				update.key = req.body.key;
			}
			if (req.body.value) {
				update.value = req.body.value;
			}
			if (req.body.flag) {
				update.flag = req.body.flag;
			}

			let metaData = await Meta.findOne({
				where: {
					id: metaId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking meta exists or not',
						error: err
					})
				})
			if (!metaData) {
				return res.send({
					success: 0,
					message: 'Invalid meta '
				})
			} else {
				if (req.body.key || req.body.value) {
					let metaCheckData = await Meta.findOne({
						where: {
							key: req.body.key,
							value: req.body.value,
							status: 1,
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking meta already exists or not',
								error: err
							})
						})
					if (metaCheckData && (metaCheckData.id !== metaId)) {
						return res.send({
							success: 0,
							message: 'Meta already exists '
						})
					}
				}

				await Meta.update(update, {
					where: {
						id: metaId
					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating Meta',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Meta updated successfully."
				});
			}


		},


		this.listMeta = async (req, res) => {
			let params = req.query;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;

			var metaData = await Meta.findAll({
				raw: true,
				order: [
					['modified_at', 'DESC']
				],
				offset: offset,
				where: {
					status: 1
				},
				limit: perPage,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching meta data',
						error: err
					})
				});

			var count = await Meta.count({
				where: {
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching meta count data',
						error: err
					})
				});

			totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: metaData,
				total_items: count,
				has_next_page: hasNextPage,
				total_pages: totalPages,
				page,
				per_page: perPage,
				message: "Meta listed successfully",
				success: 1,
			}
			res.send(response);
		},

		this.getMeta = async (req, res) => {
			let metaId = req.params.id;
			let metaData = await Meta.findOne({
				where: {
					id: metaId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting meta data',
						error: err
					})
				})

			let response = {
				metaData: metaData,
				success: 1,
			}
			res.send(response);
		},
		this.deleteMeta = async (req, res) => {
			let metaId = req.params.id;
			let metaData = await Meta.findOne({
				where: {
					id: metaId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting meta data',
						error: err
					})
				})
			if (metaData != null) {
				let update = {
					status: 0
				}
				await Meta.update(update, {
					where: {
						id: metaData.id

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while deleting meta',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Meta deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "Meta not exists."
				});
			}


		},
		this.getUserTypes = async (req, res) => {
			let userTypes = await UserType.findAll({
				where: {
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting user types',
						error: err
					})
				})
			let response = {
				userTypeData: userTypes,
				success: 1,
				message: "User types listed."
			}
			res.status(200).send(response);
		},
		this.createUser = async (req, res) => {
			let params = req.body;

			if (!params.name || !params.gender ||
				!params.email || !params.phone || !params.designation ||
				!params.password || (!params.role && !params.user_type)) {
				var errors = [];

				if (!params.name) {
					errors.push({
						field: "name",
						message: "Require Name "
					});
				}
				// if (!params.middle_name) {
				// 	errors.push({
				// 		field: "middle_name",
				// 		message: "Require middle name "
				// 	});
				// }
				// if (!params.last_name) {
				// 	errors.push({
				// 		field: "last_name",
				// 		message: "Require last name "
				// 	});
				// }
				if (params.role) {
					if (params.role != 'secreteries' && params.role != 'facility-surveyers') {
						if (!params.designation) {
							errors.push({
								field: "designation",
								message: "Require designation"
							});
						}
					}
				}
				if (!params.lsgi_id) {
					errors.push({
						field: "lsgi_id",
						message: "Require Lsgi Id "
					});
				}
				if (!params.lsgi_type_id) {
					errors.push({
						field: "lsgi_type_id",
						message: "Require Lsgi Type Id "
					});
				}
				if (!params.gender) {
					errors.push({
						field: "gender",
						message: "Require gender"
					});
				}
				if (!params.district_id) {
					errors.push({
						field: "district_id",
						message: "Require district id "
					});
				}
				if (!params.user_type && !params.role) {
					errors.push({
						field: "user_type or role",
						message: "Please specify role or user_type"
					});
				}
				// if (!params.role) {
				// 	errors.push({
				// 		field: "role",
				// 		message: "Require Role"
				// 	});
				// }
				// if (!params.name_en) {
				//   errors.push({
				//     field: "name_en",
				//     message: "Name in English cannot be empty"
				//   });
				// }
				// if (!params.name_ml ) {
				//   errors.push({
				//     field: "name_ml",
				//     message: "Name in Malayalam cannot be empty"
				//   });
				// }
				if (!params.email) {
					errors.push({
						field: "email",
						message: "Require email"
					});
				}
				if (!params.phone) {
					errors.push({
						field: "phone",
						message: "Require phone"
					});
				}
				if (!params.password) {
					errors.push({
						field: "password",
						message: "Require password"
					});
				}


				return res.send({
					success: 0,
					statusCode: 400,
					errors: errors,
				});
			};
			if (params.role) {
				let roleData = await AuthRole.findOne({
					where: {
						name: params.role,
						status: 1
					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while checking phone',
							error: err
						})
					})
				if (!roleData) {
					return res.send({
						success: 0,
						message: 'Invalid role..',
					})
				} else {
					params.role_id = roleData.id;
				}
			}

			const hash = bcrypt.hashSync(params.password, salt);

			let userObj = {
				name: params.name.trim(),
				email: params.email.trim(),
				phone: params.phone.trim(),
				role_id: params.role_id,
				password: hash,
				status: 1
			}
			if (params.user_type) {
				userObj.user_type = params.user_type;
			}
			if (params.user_type == 'secratery_section_user') {
				userObj.role_id = 53;
			}
			if (params.middle_name) {
				userObj.middle_name = params.middle_name;
			}
			if (params.last_name) {
				userObj.last_name = params.last_name;

			}
			if (params.designation) {
				userObj.designation = params.designation;
			}
			if (params.lsgi_id) {
				userObj.lsgi_id = params.lsgi_id;
			}

			if (params.lsgi_type_id) {
				userObj.lsgi_type_id = params.lsgi_type_id;
			}

			if (params.gender) {
				userObj.gender = params.gender;
			}

			if (params.district_id) {
				userObj.district_id = params.district_id;
			}
			if (params.lsgi_block_id) {
				userObj.lsgi_block_id = params.lsgi_block_id;
			}

			let checkPhone = await User.findOne({
				where: {
					phone: params.phone,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking phone',
						error: err
					})
				})
			if (checkPhone && checkPhone !== null) {
				return res.send({
					success: 0,
					message: 'Phone already exists..',
				})
			}

			let checkEmail = await User.findOne({
				where: {
					email: params.email,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking email',
						error: err
					})
				})
			if (checkEmail && checkEmail !== null) {
				return res.send({
					success: 0,
					message: 'Email already exists..',
				})
			}

			try {
				let data = await User.create(userObj);
				res.status(200).send({
					success: 1,
					id: data.dataValues.id,
					message: "User created successfully."
				});
			} catch (err) {
				console.log(err);
				return res.send({
					success: 0,
					message: 'Error while creating a user',
					err: err
				})
			}
		},
		// updateUser
		this.updateUser = async (req, res) => {
			let userId = req.params.id;
			let update = {};
			let params = req.body;
			update.modified_at = new Date();
			update.status = 1;
			if (!params.name && !params.gender &&
				!params.middle_name && !params.last_name &&
				!params.email && !params.phone && !params.designation &&
				!params.role && !params.user_type) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}
			if (params.name) {
				update.name = params.name;
			}
			if (params.gender) {
				update.gender = params.gender;
			}

			if (params.district_id) {
				update.district_id = params.district_id;
			} else {
				update.district_id = null;
			}
			if (params.lsgi_type_id) {
				update.lsgi_type_id = params.lsgi_type_id;
			} else {
				update.lsgi_type_id = null;
			}
			if (params.middle_name) {
				update.middle_name = params.middle_name;
			}
			if (params.lsgi_block_id) {
				update.lsgi_block_id = params.lsgi_block_id;
			} else {
				update.lsgi_block_id = null;
			}
			if (params.last_name) {
				update.last_name = params.last_name;
			}
			if (params.email) {
				update.email = params.email;
			}
			if (params.phone) {
				update.phone = params.phone;
			}
			if (params.designation) {
				update.designation = params.designation;
			}
			if (params.lsgi_id) {
				update.lsgi_id = params.lsgi_id;
			} else {
				update.lsgi_id = null;
			}

			if (params.user_type) {
				update.user_type = params.user_type;
			}
			if (params.role) {
				let roleData = await AuthRole.findOne({
					where: {
						name: params.role,
						status: 1
					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while checking phone',
							error: err
						})
					})
				if (!roleData) {
					return res.send({
						success: 0,
						message: 'Invalid role..',
					})
				} else {
					params.role_id = roleData.id;
				}
			}



			// if (params.password) {
			// 	update.password = params.password;
			// }


			let idData = await User.findOne({
				where: {
					id: userId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking user id exists or not',
						error: err
					})
				})
			if (!idData) {
				return res.send({
					success: 0,
					message: 'Invalid user '
				})
			} else {
				if (params.email) {
					let emailData = await User.findOne({
						where: {
							email: params.email,
							status: 1,
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking email already exists or not',
								error: err
							})
						})
					if (emailData && (emailData.email !== idData.email)) {
						return res.send({
							success: 0,
							message: 'Email already exists '
						})
					}
				}

				if (params.phone) {
					let phoneData = await User.findOne({
						where: {
							email: params.phone,
							status: 1,
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking phone already exists or not',
								error: err
							})
						})
					if (phoneData && (phoneData.phone !== idData.phone)) {
						return res.send({
							success: 0,
							message: 'Phone already exists '
						})
					}
				}


				await User.update(update, {
					where: {
						id: userId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating user',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "User updated successfully."
				});
			}


		},
		this.alluserslist = async (req, res) => {
			var userData = [];
			var count = 0;
			let params = req.query;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;
			let whereCondition = {
				status: 1
			}
			let userDataz = req.identity.data;
			if (userDataz.district_id && userDataz.district_id != null) {
				whereCondition.district_id = userDataz.district_id;
			}
			if (userDataz.lsgi_id && userDataz.lsgi_id != null) {
				whereCondition.lsgi_id = userDataz.lsgi_id;
			}
			if (userDataz.lsgi_block_id && userDataz.lsgi_block_id != null) {
				whereCondition.lsgi_block_id = userDataz.lsgi_block_id;
			}
			// if(userDataz.ward_id && userDataz.ward_id!=null){
			// 	whereCondition.ward_id=userDataz.ward_id;
			// }
			userData = await User.findAll({
				// raw: true,
				order: [
					['modified_at', 'DESC']
				],
				offset: offset,
				where: whereCondition,
				include: [{
					model: Lsgi,
					as: "lsgi"
				}, {
					model: LsgiBlock,
					as: 'lsgi_block'
				}, {
					model: District,
					as: 'district'
				}, {
					model: AuthRole,
					as: 'role'
				}, {
					model: LsgiType,
					as: 'lsgi_type'
				}],
				limit: perPage,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching user data',
						error: err
					})
				});

			count = await User.count({
				where: whereCondition,
			})
				.catch(err => {

					return res.send({
						success: 0,
						message: 'Something went wrong while fetching user data',
						error: err
					})
				});
			if (!userData || userData === null) {
				userData = [];
			}
			totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: userData,
				total_items: count,
				has_next_page: hasNextPage,
				total_pages: totalPages,
				page,
				per_page: perPage,
				message: "User data listed successfully",
				success: 1,
			}
			res.send(response);
		},
		this.listUser = async (req, res) => {
			var userData = [];
			var count = 0;
			let params = req.query;
			let roleName;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;
			let whereCondition = {
				status: 1
			}
			if (params.keyword) {
				let name = {
					[Op.like]: '%' + params.keyword + '%',
				};
				let middle_name = {
					[Op.like]: '%' + params.keyword + '%'
				};
				let last_name = {
					[Op.like]: '%' + params.keyword + '%'
				};
				whereCondition = Sequelize.or({ middle_name }, { last_name }, { name })
			}
			if (params.district_id) {
				whereCondition.district_id = params.district_id
			}
			if (params.lsgi_type_id) {
				whereCondition.lsgi_type_id = params.lsgi_type_id
			}
			if (params.lsgi_id) {
				whereCondition.lsgi_id = params.lsgi_id
			}
			if (params.email) {
				whereCondition.email = params.email
			}
			if (params.phone) {
				whereCondition.phone = params.phone
			}
			if (params.user_type) {
				whereCondition.user_type = params.user_type
			}
			if (params.name) {
				whereCondition.name = params.name
			}
			if (params.lsgi_block_id) {
				whereCondition.lsgi_block_id = params.lsgi_block_id
			}
			let userDataz = req.identity.data;
			if (userDataz.district_id && userDataz.district_id != null) {
				whereCondition.district_id = userDataz.district_id;
			}
			if (userDataz.lsgi_id && userDataz.lsgi_id != null) {
				whereCondition.lsgi_id = userDataz.lsgi_id;
			}
			if (userDataz.lsgi_block_id && userDataz.lsgi_block_id != null) {
				whereCondition.lsgi_block_id = userDataz.lsgi_block_id;
			}
			// if(userDataz.ward_id && userDataz.ward_id!=null){
			// 	whereCondition.ward_id=userDataz.ward_id;
			// }
			if (req.params.roleName) {
				roleName = req.params.roleName;
				let rolewhereCondition = {
					name: roleName,
					status: 1
				};
				let findroleId = await AuthRole.findOne({
					where: rolewhereCondition
				}).catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching role data using rolename',
						error: err
					})
				})
				if (findroleId && findroleId != null) {
					whereCondition.role_id = findroleId.id;
				}
				whereCondition.status = 1;
				userData = await User.findAll({
					// raw: true,
					order: [
						['modified_at', 'DESC']
					],
					offset: offset,
					where: whereCondition,
					include: [{
						model: Lsgi,
						as: "lsgi"
					}, {
						model: LsgiBlock,
						as: 'lsgi_block'
					}, {
						model: District,
						as: 'district'
					}, {
						model: AuthRole,
						as: 'role'
					}, {
						model: LsgiType,
						as: 'lsgi_type'
					}],
					limit: perPage,
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while fetching user data using rolename',
							error: err
						})
					});

				count = await User.count({
					where: whereCondition,
					include: [{
						model: Lsgi,
						as: "lsgi"
					}, {
						model: LsgiBlock,
						as: 'lsgi_block'
					}, {
						model: District,
						as: 'district'
					}, {
						model: AuthRole,
						as: 'role',
						where: rolewhereCondition
					}, {
						model: LsgiType,
						as: 'lsgi_type'
					}],
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while fetching user data count',
							error: err
						})
					});





			}
			console.log("whereCondition")
			console.log(whereCondition)
			// console.log("whereCondition")
			// if (params.lsgiTypeId) {
			//   whereCondition.lsgi_type_id = params.lsgiTypeId
			// }
			// if (params.lsgiBlockId) {
			//   whereCondition.lsgi_block_id = params.lsgiBlockId
			// }

			userData = await User.findAll({
				// raw: true,
				order: [
					['modified_at', 'DESC']
				],
				offset: offset,
				include: [{
					model: Lsgi,
					as: "lsgi"
				}, {
					model: LsgiBlock,
					as: 'lsgi_block'
				}, {
					model: District,
					as: 'district'
				}, {
					model: AuthRole,
					as: 'role'
				}, {
					model: LsgiType,
					as: 'lsgi_type'
				}],
				where: whereCondition,
				limit: perPage,
			})
				.catch(err => {
					return {
						success: 0,
						message: 'Something went wrong while  xx fetching user data',
						error: err
					}
				});
			if (userData.error) {
				return res.send(userData)
			}
			count = await User.count({
				where: whereCondition,
			})
				.catch(err => {

					return {
						success: 0,
						message: 'Something went wrong  while fetching user data count',
						error: err
					}
				});
			if (count.error) {
				return res.send(count)
			}

			if (!userData || userData === null) {
				userData = [];
			}
			totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: userData,
				total_items: count,
				has_next_page: hasNextPage,
				total_pages: totalPages,
				page,
				per_page: perPage,
				message: "User data listed successfully",
				success: 1,
			}
			res.send(response);
		},


		this.getUser = async (req, res) => {
			let userId = req.params.id;
			let userData = await User.findOne({
				where: {
					id: userId,
					status: 1
				},
				include: [{
					model: Lsgi,
					as: "lsgi"
				}, {
					model: LsgiBlock,
					as: 'lsgi_block'
				}, {
					model: District,
					as: 'district'
				}, {
					model: AuthRole,
					as: 'role'
				}, {
					model: LsgiType,
					as: 'lsgi_type'
				},

				]
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting user data',
						error: err
					})
				})
			let response = {
				user: userData,
				success: 1,
			}
			res.send(response);
		},


		this.deleteUser = async (req, res) => {
			let userId = req.params.id;
			let userData = await User.findOne({
				where: {
					id: userId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting user data',
						error: err
					})
				})
			if (userData) {
				let update = {
					status: 0
				}
				await userData.update(update, {
					where: {
						id: userData.id

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while deleting user',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "User deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "User not exists."
				});
			}


		},


		this.changeUserPassword = async (req, res) => {
			let params = req.body;
			let userId = req.params.id;
			if (!params.password) {
				var errors = [];

				if (!params.password) {
					errors.push({
						field: "password",
						message: "Require new password"
					});
				}
				return res.send({
					success: 0,
					statusCode: 400,
					errors: errors,
				});
			};
			let userData = await User.findOne({
				where: {
					id: userId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking user id exists or not',
						error: err
					})
				})
			if (!userData || userData === null) {
				return res.send({
					success: 0,
					message: 'Invalid user '
				})
			}

			const hash = bcrypt.hashSync(params.password, salt);

			let update = {
				password: hash,
				modified_at: new Date()
			}
			await User.update(update, {
				where: {
					id: userId

				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while updating user password',
						error: err
					})
				})
			return res.status(200).send({
				success: 1,
				message: "User updated password successfully."
			});
		},

		this.changeAdminPassword = async (req, res) => {
			let params = req.body;
			let userDatas = req.identity.data;
			let userId = userDatas.id;
			if (!params.new_password) {
				var errors = [];

				if (!params.new_password) {
					errors.push({
						field: "new_password",
						message: "Require new password"
					});
				}
				return res.send({
					success: 0,
					statusCode: 400,
					errors: errors,
				});
			};
			let userData = await User.findOne({
				where: {
					id: userId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking user id exists or not',
						error: err
					})
				})
			if (!userData || userData === null || (userData.user_type === constants.TYPE_ADMIN)) {
				return res.send({
					success: 0,
					message: 'Invalid user '
				})
			}

			const hash = bcrypt.hashSync(params.new_password, salt);

			let update = {
				password: hash,
				modified_at: new Date()
			}
			await User.update(update, {
				where: {
					id: userId

				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while updating admin password',
						error: err
					})
				})
			res.status(200).send({
				success: 1,
				message: "Admin updated password successfully."
			});
		},


		// statusUpdate
		this.statusUpdate = async (req, res) => {
			if (!req.params.id) {
				return res.status(200).send({
					success: 1,
					message: "User ID missing."
				});
			}
			console.log((!req.body.isApproved) || (Number(req.body.isApproved) !== 0 && Number(req.body.isApproved) !== 1))
			if ((!req.body.isApproved) || (Number(req.body.isApproved) !== 0 && Number(req.body.isApproved) !== 1)) {
				return res.status(200).send({
					success: 1,
					message: "Status missing..."
				});
			}
			let params = req.body;
			let userId = req.params.id;
			let status = params.isApproved
			let update = {};
			update.is_approved = status;


			let idData = await User.findOne({
				where: {
					id: userId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking user id exists or not',
						error: err
					})
				})
			if (!idData) {
				return res.send({
					success: 0,
					message: 'Invalid user '
				})
			} else {
				console.log("idData.isApproved : " + idData.is_approved)
				console.log("status : " + status)
				if (Number(idData.is_approved) === 1 && Number(status) === 1) {
					return res.send({
						success: 0,
						message: 'Already approved '
					})
				}
				if (Number(idData.is_approved) === 0 && Number(status) === 0) {
					return res.send({
						success: 0,
						message: 'Already disapproved '
					})
				}

				await User.update(update, {
					where: {
						id: userId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while user status',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "User updated status successfully."
				});
			}


		},


		this.createGradeConfig = async (req, res) => {
			let params = req.body;
			console.log("params");
			console.log(params);
			console.log("params");

			if (params.start_value === undefined || !params.end_value) {
				var errors = [];
				if (params.start_value === undefined) {
					errors.push({
						field: "otp",
						message: "otp is missing"
					});
				}
				if (!params.end_value) {
					errors.push({
						field: "apiToken",
						message: "api Token is missing"
					});
				}
				if (!params.grade) {
					errors.push({
						success: 0,
						message: 'Require grade'
					})
				}
				return res.status(200).send({
					success: 0,
					errors: errors,
					code: 200
				});
			}


			let gradeObj = {
				start_value: params.start_value,
				end_value: params.end_value,
				grade: params.grade,
				status: 1
			}
			let startEndCheck = await GradeConfiguaration.findOne({
				where: {
					start_value: params.start_value,
					end_value: params.end_value,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking grade configuaration exists or not',
						error: err
					})
				})
			if (startEndCheck) {
				return res.send({
					success: 0,
					message: 'Satrt end value already set..'
				})
			}

			try {
				let data = await GradeConfiguaration.create(gradeObj);
				res.status(200).send({
					success: 1,
					id: data.dataValues.id,
					message: "Grade config created successfully."
				});
			} catch (err) {
				console.log(err);
				return res.send({
					success: 0,
					message: 'Error while create a Grade config'
				})
			}
		},

		this.updateGradeConfig = async (req, res) => {
			let gradeConfigId = req.params.id;
			let update = {};
			update.modified_at = new Date();
			update.status = 1;
			if (!req.body.start_value === undefined && !req.body.end_value && !req.body.grade) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}
			if (req.body.start_value) {
				update.start_value = req.body.start_value;
			}
			if (req.body.end_value) {
				update.end_value = req.body.end_value;
			}
			if (req.body.grade) {
				update.grade = req.body.grade;
			}
			let idData = await GradeConfiguaration.findOne({
				where: {
					id: gradeConfigId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking grade config id exists or not',
						error: err
					})
				})
			if (!idData) {
				return res.send({
					success: 0,
					message: 'Invalid grade config '
				})
			} else {
				if (req.body.start_value) {
					let startValueData = await GradeConfiguaration.findOne({
						where: {
							start_value: req.body.start_value,
							status: 1,
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking start value already exists or not',
								error: err
							})
						})
					if (startValueData && (startValueData.id !== gradeConfigId)) {
						return res.send({
							success: 0,
							message: 'Start value already exists '
						})
					}
				}

				if (req.body.end_value) {
					let endValueData = await GradeConfiguaration.findOne({
						where: {
							end_value: req.body.end_value,
							status: 1,
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking end value already exists or not',
								error: err
							})
						})
					if (endValueData && (endValueData.id !== gradeConfigId)) {
						return res.send({
							success: 0,
							message: 'End value already exists '
						})
					}
				}

				await GradeConfiguaration.update(update, {
					where: {
						id: gradeConfigId
					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating grade configuaration',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Grade configuaration updated successfully."
				});
			}


		},


		this.listGradeConfig = async (req, res) => {
			let params = req.query;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			whereCondition.status = 1;
			// if(params.name){
			//   whereCondition.name_en = {
			//     [Op.like]: '%' + params.name + '%'
			//   };
			//   // whereCondition.name_ml = {
			//   //   [Op.like]: '%' + params.name + '%'
			//   // };
			// }

			var gradeConfiguarationData = await GradeConfiguaration.findAll({
				// raw: true,
				order: [
					['modified_at', 'DESC']
				],
				offset: offset,
				where: whereCondition,
				// where: {
				//   status: 1
				// },
				limit: perPage,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching grade configuaration data',
						error: err
					})
				});

			var count = await GradeConfiguaration.count({
				where: whereCondition,

			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching grade configuaration count data',
						error: err
					})
				});

			totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: gradeConfiguarationData,
				total_items: count,
				has_next_page: hasNextPage,
				total_pages: totalPages,
				page,
				per_page: perPage,
				message: "Grade configuaration listed successfully",
				success: 1,
			}
			return res.send(response);
		},
		this.getGradeConfiguaration = async (req, res) => {
			let gradeConfiguarationId = req.params.id;
			let gradeConfiguarationData = await GradeConfiguaration.findOne({
				where: {
					id: gradeConfiguarationId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting grade configuaration data',
						error: err
					})
				})
			let response = {
				gradeConfiguaration: gradeConfiguarationData,
				success: 1,
			}
			return res.send(response);
		},
		this.deleteGradeConfiguaration = async (req, res) => {
			let gradeConfiguarationId = req.params.id;
			let gradeConfiguarationData = await GradeConfiguaration.findOne({
				where: {
					id: gradeConfiguarationId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting grade configuaration data',
						error: err
					})
				})
			if (gradeConfiguarationData) {
				let update = {
					status: 0
				}
				await GradeConfiguaration.update(update, {
					where: {
						id: gradeConfiguarationData.id

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating GradeConfiguaration',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Grade configuation deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "Grade configuation not exists."
				});
			}


		},


		this.createPercentageConfig = async (req, res) => {
			let params = req.body;
			console.log("params");
			console.log(params);
			console.log("params");
			if (params.name === undefined) {
				return res.send({
					success: 0,
					message: 'Require name'
				})
			}

			let percentageObj = {
				name: params.name,
				status: 1
			}
			let nameCheck = await PercentageConfiguaration.findOne({
				where: {
					name: params.name,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking percentage configuaration exists or not',
						error: err
					})
				})
			if (nameCheck) {
				return res.send({
					success: 0,
					message: 'Name already set..'
				})
			}

			try {
				let data = await PercentageConfiguaration.create(percentageObj);
				res.status(200).send({
					success: 1,
					id: data.dataValues.id,
					message: "Percentage config created successfully."
				});
			} catch (err) {
				console.log(err);
				return res.send({
					success: 0,
					message: 'Error while create a Percentage config'
				})
			}
		},

		this.updatePercentageConfig = async (req, res) => {
			let percentageConfigId = req.params.id;
			let update = {};
			update.modified_at = new Date();
			update.status = 1;
			if (!req.body.name === undefined) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}
			if (req.body.name) {
				update.name = req.body.name;
			}

			let idData = await PercentageConfiguaration.findOne({
				where: {
					id: percentageConfigId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking percentage config id exists or not',
						error: err
					})
				})
			if (!idData) {
				return res.send({
					success: 0,
					message: 'Invalid percentage config '
				})
			} else {
				if (req.body.name) {
					let nameData = await PercentageConfiguaration.findOne({
						where: {
							name: req.body.name,
							status: 1,
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking name value already exists or not',
								error: err
							})
						})
					if (nameData && (nameData.id !== percentageConfigId)) {
						return res.send({
							success: 0,
							message: 'Name already exists '
						})
					}
				}


				await PercentageConfiguaration.update(update, {
					where: {
						id: percentageConfigId
					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating percentage configuaration',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Percentage configuaration updated successfully."
				});
			}


		},


		this.listPercentageConfig = async (req, res) => {
			let params = req.query;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			whereCondition.status = 1;
			// if(params.name){
			//   whereCondition.name_en = {
			//     [Op.like]: '%' + params.name + '%'
			//   };
			//   // whereCondition.name_ml = {
			//   //   [Op.like]: '%' + params.name + '%'
			//   // };
			// }

			var percentageConfiguarationData = await PercentageConfiguaration.findAll({
				// raw: true,
				order: [
					['modified_at', 'DESC']
				],
				offset: offset,
				where: whereCondition,
				// where: {
				//   status: 1
				// },
				limit: perPage,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching percentage configuaration data',
						error: err
					})
				});

			var count = await PercentageConfiguaration.count({
				where: whereCondition,

			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching Percentage configuaration count data',
						error: err
					})
				});

			totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: percentageConfiguarationData,
				total_items: count,
				has_next_page: hasNextPage,
				total_pages: totalPages,
				page,
				per_page: perPage,
				message: "Percentage configuaration listed successfully",
				success: 1,
			}
			return res.send(response);
		},
		this.getPercentageConfig = async (req, res) => {
			let percentageConfiguarationId = req.params.id;
			let percentageConfiguarationData = await PercentageConfiguaration.findOne({
				where: {
					id: percentageConfiguarationId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting percentage configuaration data',
						error: err
					})
				})
			let response = {
				percentageConfiguaration: percentageConfiguarationData,
				success: 1,
			}
			return res.send(response);
		},
		this.deletePercentageConfig = async (req, res) => {
			let percentageConfigId = req.params.id;
			let percentageConfigData = await PercentageConfiguaration.findOne({
				where: {
					id: percentageConfigId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting percentage configuaration data',
						error: err
					})
				})
			if (percentageConfigData) {
				let update = {
					status: 0
				}
				await PercentageConfiguaration.update(update, {
					where: {
						id: percentageConfigData.id

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while deleting Percentage Config',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Percentage configuation deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "Percentage configuation not exists."
				});
			}


		},

		this.createPercentageConfigSlab = async (req, res) => {
			let params = req.body;


			if (params.start_value === undefined || params.end_value === undefined
				|| params.points === undefined || !params.percentage_config_id) {
				var errors = [];
				if (params.start_value === undefined) {
					errors.push({
						field: "start_value",
						message: "otp is missing"
					});
				}
				if (params.end_value === undefined) {
					errors.push({
						field: "end_value",
						message: "end value is missing"
					});
				}
				if (params.points === undefined) {
					errors.push({
						success: 0,
						message: 'Require points'
					})
				}
				if (!params.percentage_config_id) {
					errors.push({
						success: 0,
						message: 'Require percentage config id'
					})
				}
				return res.status(200).send({
					success: 0,
					errors: errors,
					code: 200
				});
			}


			let percentageConfigSlabObj = {
				start_value: params.start_value,
				end_value: params.end_value,
				points: params.points,
				percentage_config_id: params.percentage_config_id,
				status: 1
			}
			let startValueCheck = await PercentageConfigSlab.findOne({
				where: {
					start_value: params.start_value,
					percentage_config_id: params.percentage_config_id,

					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking start value exists or not',
						error: err
					})
				})
			if (startValueCheck) {
				return res.send({
					success: 0,
					message: 'Start value already set..'
				})
			}

			let endValueCheck = await PercentageConfigSlab.findOne({
				where: {
					end_value: params.end_value,
					percentage_config_id: params.percentage_config_id,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking end value exists or not',
						error: err
					})
				})
			if (endValueCheck) {
				return res.send({
					success: 0,
					message: 'end value already set..'
				})
			}

			let percentageConfigIdCheck = await PercentageConfiguaration.findOne({
				where: {
					id: params.percentage_config_id,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking percentageConfigId exists or not',
						error: err
					})
				})
			if (!percentageConfigIdCheck) {
				return res.send({
					success: 0,
					message: 'percentageConfigId in valid..'
				})
			}


			try {
				let data = await PercentageConfigSlab.create(percentageConfigSlabObj);
				res.status(200).send({
					success: 1,
					id: data.dataValues.id,
					message: "Percentage config slab created successfully."
				});
			} catch (err) {
				console.log(err);
				return res.send({
					success: 0,
					message: 'Error while create a Percentage config slab'
				})
			}
		},

		this.updatePercentageConfigSlab = async (req, res) => {
			let percentageConfigSlabId = req.params.id;
			let params = req.body;
			let update = {};
			update.modified_at = new Date();
			update.status = 1;

			if (params.start_value === undefined && params.end_value === undefined &&
				!params.points && !params.percentage_config_id) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}
			if (params.start_value) {
				update.start_value = params.start_value
			}
			if (params.endValue) {
				update.end_value = params.end_value
			}
			if (params.points) {
				update.end_value = params.points
			}
			if (params.percentage_config_id) {
				update.percentage_config_id = params.percentage_config_id
			}
			let idData = await PercentageConfigSlab.findOne({
				where: {
					id: percentageConfigSlabId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking percentage config slab id exists or not',
						error: err
					})
				})
			if (!idData) {
				return res.send({
					success: 0,
					message: 'Invalid percentage config slab id'
				})
			} else {
				if (params.percentage_config_id) {
					let percentageData = await PercentageConfiguaration.findOne({
						where: {
							id: params.percentage_config_id,
							status: 1,
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking percentage config id already exists or not',
								error: err
							})
						})
					if (!percentageData) {
						return res.send({
							success: 0,
							message: 'Percentage config id invalid'
						})
					}
				}
				if (req.body.start_value) {
					let startValueData = await PercentageConfigSlab.findOne({
						where: {
							start_value: req.body.start_value,
							percentage_config_id: params.percentage_config_id,
							status: 1,
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking start value value already exists or not',
								error: err
							})
						})
					if (startValueData && (startValueData.id !== percentageConfigSlabId)) {
						return res.send({
							success: 0,
							message: 'Start value already exists '
						})
					}
				}

				if (req.body.start_value) {
					let startValueData = await PercentageConfigSlab.findOne({
						where: {
							start_value: req.body.start_value,
							percentage_config_id: params.percentage_config_id,
							status: 1,
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking start value value already exists or not',
								error: err
							})
						})
					if (startValueData && (startValueData.id !== percentageConfigSlabId)) {
						return res.send({
							success: 0,
							message: 'Start value already exists '
						})
					}
				}
				if (req.body.end_value) {
					let endValueData = await PercentageConfigSlab.findOne({
						where: {
							end_value: req.body.end_value,
							percentage_config_id: params.percentage_config_id,
							status: 1,
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking end value value already exists or not',
								error: err
							})
						})
					if (endValueData && (endValueData.id !== percentageConfigSlabId)) {
						return res.send({
							success: 0,
							message: 'End value already exists '
						})
					}
				}

				await PercentageConfigSlab.update(update, {
					where: {
						id: percentageConfigSlabId
					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating percentage config slab',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Percentage config slab updated successfully."
				});
			}


		},


		this.listPercentageConfigSlab = async (req, res) => {
			let params = req.query;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			whereCondition.status = 1;
			// if(params.name){
			//   whereCondition.name_en = {
			//     [Op.like]: '%' + params.name + '%'
			//   };
			//   // whereCondition.name_ml = {
			//   //   [Op.like]: '%' + params.name + '%'
			//   // };
			// }
			if (params.percentage_config_id) {
				whereCondition.percentage_config_id = params.percentage_config_id;
			}
			var percentageConfigSlabData = await PercentageConfigSlab.findAll({
				// raw: true,
				order: [
					['modified_at', 'DESC']
				],
				offset: offset,
				where: whereCondition,
				// where: {
				//   status: 1
				// },
				include: [{
					model: PercentageConfiguaration
				}],
				limit: perPage,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching percentage configuaration slab data',
						error: err
					})
				});

			var count = await PercentageConfigSlab.count({
				where: whereCondition,

			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching Percentage configuaration slab count data',
						error: err
					})
				});

			totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: percentageConfigSlabData,
				total_items: count,
				has_next_page: hasNextPage,
				total_pages: totalPages,
				page,
				per_page: perPage,
				message: "Percentage configuaration slab listed successfully",
				success: 1,
			}
			return res.send(response);
		},
		this.getPercentageConfigSlab = async (req, res) => {
			let percentageConfigSlabId = req.params.id;
			let percentageConfigSlabData = await PercentageConfigSlab.findOne({
				where: {
					id: percentageConfigSlabId,
					status: 1
				},
				include: [{
					model: PercentageConfiguaration
				}]
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting percentage configuaration slab data',
						error: err
					})
				})
			let response = {
				percentageConfiguarationSlab: percentageConfigSlabData,
				success: 1,
			}
			return res.send(response);
		},
		this.deletePercentageConfigSlab = async (req, res) => {
			let percentageConfigSlabId = req.params.id;
			let percentageConfiguarationSlabData = await PercentageConfigSlab.findOne({
				where: {
					id: percentageConfigSlabId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting percentage configuaration slab data',
						error: err
					})
				})
			if (percentageConfiguarationSlabData) {
				let update = {
					status: 0
				}
				await PercentageConfigSlab.update(update, {
					where: {
						id: percentageConfiguarationSlabData.id

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while deleting Percentage Config Slab',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Percentage configuation slab deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "Percentage configuation slab not exists."
				});
			}


		},

		this.createNotification = async (req, res) => {
			let params = req.body;
			if (!params.title || !params.content) {
				var errors = [];
				if (!otp) {
					errors.push({
						field: "otp",
						message: "otp is missing"
					});
				}
				// if (!apiToken) {
				// 	errors.push({
				// 		field: "apiToken",
				// 		message: "api Token is missing"
				// 	});
				// }

				if (!params.title) {

					errors.push({
						field: "title",
						message: "title is missing"
					});
				}
				if (!params.content) {
					errors.push({
						field: "content",
						message: "content is missing"
					});
				}

				return res.status(200).send({
					success: 0,
					errors: errors,
					code: 200
				});
			}

			let notificationObj = {
				title: params.title,
				content: params.content,
				status: 1
			}

			try {
				let data = await Notification.create(notificationObj);
				res.status(200).send({
					id: data.dataValues.id,
					success: 1,
					message: "Notification created successfully."
				});
			} catch (err) {
				console.log(err);
				return res.send({
					success: 0,
					message: 'Error while create a Notification'
				})
			}
		},

		this.updateNotification = async (req, res) => {
			let notifId = req.params.id;
			let params = req.body;
			let update = {};
			update.modified_at = new Date();
			update.status = 1;

			if (!params.title && !params.content) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}
			if (params.title) {
				update.title = params.title
			}
			if (params.content) {
				update.content = params.content
			}

			let idData = await Notification.findOne({
				where: {
					id: notifId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking notification id exists or not',
						error: err
					})
				})
			if (!idData) {
				return res.send({
					success: 0,
					message: 'Invalid percentage notif id'
				})
			} else {


				await Notification.update(update, {
					where: {
						id: notifId
					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating notif',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "notification updated successfully."
				});
			}


		},


		this.listNotification = async (req, res) => {
			let params = req.query;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			whereCondition.status = 1;
			// if(params.name){
			//   whereCondition.name_en = {
			//     [Op.like]: '%' + params.name + '%'
			//   };
			//   // whereCondition.name_ml = {
			//   //   [Op.like]: '%' + params.name + '%'
			//   // };
			// }
			if (params.keyword) {
				let title = {
					[Op.like]: '%' + params.keyword + '%',
				};
				let content = {
					[Op.like]: '%' + params.keyword + '%'
				};
				whereCondition = Sequelize.or({ title }, { content })
			}
			var notifData = await Notification.findAll({
				// raw: true,
				order: [
					['modified_at', 'DESC']
				],
				offset: offset,
				where: whereCondition,
				// where: {
				//   status: 1
				// },

				limit: perPage,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching notification data',
						error: err
					})
				});

			var count = await Notification.count({
				where: whereCondition,

			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching notification count data',
						error: err
					})
				});

			totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: notifData,
				total_items: count,
				has_next_page: hasNextPage,
				total_pages: totalPages,
				page,
				per_page: perPage,
				message: "Notification listed successfully",
				success: 1
			}
			return res.send(response);
		},
		this.getNotification = async (req, res) => {
			let notifId = req.params.id;
			let notifData = await Notification.findOne({
				where: {
					id: notifId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting notif data',
						error: err
					})
				})
			let response = {
				notification: notifData,
				success: 1,
			}
			return res.send(response);
		},
		this.deleteNotification = async (req, res) => {
			let notifId = req.params.id;
			let notifData = await Notification.findOne({
				where: {
					id: notifId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting notif data data',
						error: err
					})
				})
			if (notifData) {
				let update = {
					status: 0
				}
				await Notification.update(update, {
					where: {
						id: notifData.id

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while deleting notification',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Notification deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "Notification not exists."
				});
			}


		},


		this.createSidebarMenu = async (req, res) => {
			let params = req.body;

			var name = req.body.name;
			var icon = req.body.icon;
			var link = req.body.link;
			var sortOrder = req.body.sort_order;
			sortOrder = sortOrder ? sortOrder : 0;
			var isUsersListMainMenu = req.body.is_user_list_main_menu;
			isUsersListMainMenu = isUsersListMainMenu ? isUsersListMainMenu : 0;
			if (!name || !icon || !link) {
				var errors = [];
				if (!name) {
					errors.push({
						field: "name",
						message: "Name cannot be empty"
					});
				}
				if (!icon) {
					errors.push({
						field: "icon",
						message: "Icon cannot be empty"
					});
				}
				if (!link) {
					errors.push({
						field: "link",
						message: "Link cannot be empty"
					});
				}
				return res.send({
					success: 0,
					statusCode: 400,
					errors: errors,
				});
			};

			let sidebarMenuObj = {
				name: params.name.trim(),
				icon: params.icon.trim(),
				link: params.link.trim(),
				sort_order: sortOrder,
				is_user_list_main_menu: isUsersListMainMenu,
				status: 1
			}
			if (req.body.parent_sidebar_menu_id) {
				sidebarMenuObj.parent_sidebar_menu_id = req.body.parent_sidebar_menu_id;

				let idData = await SidebarMenu.findOne({
					where: {
						id: req.body.parent_sidebar_menu_id
					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while checking parent sidebar menu id exists or not',
							error: err
						})
					})
				if (!idData) {
					return res.send({
						success: 0,
						message: 'Invalid parentsidebarmenu id',
					})
				}
			}

			try {

				let data = await SidebarMenu.create(sidebarMenuObj);
				res.status(200).send({
					success: 1,
					id: data.dataValues.id,
					message: "Sidebar menu created successfully."
				});
			} catch (err) {
				console.log(err);
				return res.send({
					success: 0,
					message: 'Error while creating a Sidebar menu'
				})
			}
		},

		this.updateSidebarMenu = async (req, res) => {
			let sidebarMenuId = req.params.id;
			let params = req.body;
			let update = {};
			update.modified_at = new Date();
			update.status = 1;

			if (!params.name && !params.link && !params.icon && !params.parent_sidebar_menu_id && !params.is_user_list_main_menu) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}
			if (params.name) {
				update.name = params.name
			}
			if (params.link) {
				update.link = params.link
			}
			if (params.icon) {
				update.icon = params.icon
			}
			if (params.sort_order) {
				update.sort_order = params.sort_order
			}

			if (params.is_user_list_main_menu !== undefined) {
				update.is_user_list_main_menu = params.is_user_list_main_menu
			}
			if (params.parent_sidebar_menu_id) {
				if (params.parent_sidebar_menu_id !== sidebarMenuId) {

					let idData = await SidebarMenu.findOne({
						where: {
							id: params.parent_sidebar_menu_id
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking parent sidebar menu id exists or not',
								error: err
							})
						})
					if (!idData) {
						return res.send({
							success: 0,
							message: 'Invalid parentsidebarmenu id',
						})
					} else {

						update.parent_sidebar_menu_id = params.parent_sidebar_menu_id

					}
				} else {
					return res.send({
						success: 0,
						message: 'Invalid parent id ',
					})
				}
			}

			let idData = await SidebarMenu.findOne({
				where: {
					id: sidebarMenuId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking sidebar menu id exists or not',
						error: err
					})
				})
			if (!idData) {
				return res.send({
					success: 0,
					message: 'Invalid sidebar menu id'
				})
			} else {


				await SidebarMenu.update(update, {
					where: {
						id: sidebarMenuId
					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating sidebar menu',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Sidebar menu updated successfully."
				});
			}


		},


		this.listSidebarMenu = async (req, res) => {
			let params = req.query;
			// let userData = req.identity;
			// let surveyorAccountId = userData.data.id;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			whereCondition.status = 1;
			var sideBarMenuData = {};
			if (params.return_parent_only && params.return_parent_only === "parent") {
				let allSidebarMenus = await SidebarMenu.findAll({
					where: whereCondition,
					include: [{
						model: SidebarMenu,
						as: 'parent_sidebar_menu'
					}],
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while fetching sidebarMenu data',
							error: err
						})
					});
				let responseArray = allSidebarMenus.map(function (item) { return item.toJSON() });

				let excludedIds = [];
				for (let i = 0; i < responseArray.length; i++) {
					let item = responseArray[i];

					if (item.parent_sidebar_menu_id !== null) {

						if (excludedIds.indexOf(parseInt(item.parent_sidebar_menu_id)) === -1) {
							excludedIds.push(parseInt(item.parent_sidebar_menu_id))
						}
						if (excludedIds.indexOf(parseInt(item.id) === -1)) {
							excludedIds.push(parseInt(item.id))
						}
					}
				}

				whereCondition.id = {
					[Op.notIn]: excludedIds
				}

				sideBarMenuData = await SidebarMenu.findAll({
					order: [
						['modified_at', 'DESC']
					],
					offset: offset,
					where: whereCondition,

					include: [{
						model: SidebarMenu,
						as: 'parent_sidebar_menu'
					}],

					limit: perPage,
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while fetching sidebarMenu data',
							error: err
						})
					});

				var count = await SidebarMenu.count({
					where: whereCondition,

				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while fetching sidebarMenu count data',
							error: err
						})
					});




			} else {



				sideBarMenuData = await SidebarMenu.findAll({
					// raw: true,
					order: [
						['modified_at', 'DESC']
					],
					offset: offset,
					where: whereCondition,
					// where: {
					//   status: 1
					// },
					include: [{
						model: SidebarMenu,
						as: 'parent_sidebar_menu'
					}],

					limit: perPage,
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while fetching sidebarMenu data',
							error: err
						})
					});

				var count = await SidebarMenu.count({
					where: whereCondition,

				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while fetching sidebarMenu count data',
							error: err
						})
					});
			}
			totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: sideBarMenuData,
				total_items: count,
				has_next_page: hasNextPage,
				total_pages: totalPages,
				page,
				per_page: perPage,
				message: "Sidebar menu data listed successfully",
				success: 1,
			}
			return res.send(response);
		},
		this.getSidebarMenu = async (req, res) => {
			let sideBarMenuId = req.params.id;
			let sideBarMenuData = await SidebarMenu.findOne({
				where: {
					id: sideBarMenuId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting sideBarMenu data',
						error: err
					})
				})
			let response = {
				sidebarMenu: sideBarMenuData,
				success: 1,
			}
			return res.send(response);
		},
		this.deleteSidebarMenu = async (req, res) => {
			let sideBarMenuId = req.params.id;
			let sideBarMenuData = await SidebarMenu.findOne({
				where: {
					id: sideBarMenuId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting sideBarMenu data',
						error: err
					})
				})
			if (sideBarMenuData) {
				let update = {
					status: 0
				}
				await SidebarMenu.update(update, {
					where: {
						id: sideBarMenuData.id

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while deleting sidebarmenu',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Sidebarmenu deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "Sidebarmenu not exists."
				});
			}


		},


		this.createQuestion = async (req, res) => {
			let params = req.body;


			if (!params.question_en || !params.question_ml
				|| !params.type
				|| !params.sort_order) {
				var errors = [];
				if (!params.question_en) {
					errors.push({
						field: "question_en",
						message: "Question in English cannot be empty"
					});
				}
				if (!params.question_ml) {
					errors.push({
						field: "question_ml",
						message: "Name in Malayalam cannot be empty"
					});
				}




				if (!params.type) {
					errors.push({
						field: "type",
						message: "Type cannot be empty"
					});
				}
				if (!params.sort_order) {
					errors.push({
						field: "sort_order",
						message: "Sort order cannot be empty"
					});
				}

				return res.send({
					success: 0,
					statusCode: 400,
					errors: errors,
				});

			};
			if (params.is_mandatory) {
				errors = []
				if (!params.error_message) {
					errors.push({
						field: "error_message",
						message: "error_message cannot be empty"
					});
					return res.send({
						success: 0,
						statusCode: 400,
						errors: errors,
					});
				}
			}
			let questionObj = {
				question_en: params.question_en.trim(),
				question_ml: params.question_ml.trim(),
				error_message: params.error_message.trim(),
				type: params.type.trim(),
				sort_order: params.sort_order,
				status: 1
			}
			if (params.is_percentage_calculation === undefined) {
				questionObj.is_percentage_calculation = 0
			} else {
				questionObj.is_percentage_calculation = params.is_percentage_calculation;
			}
			if (params.is_email === undefined) {
				questionObj.is_email = 0
			} else {
				questionObj.is_email = params.is_email;
			}
			if (!params.sort_order) {
				questionObj.sort_order = 0;
			} else {
				questionObj.sort_order = params.sort_order;
			}
			if (params.is_phone === undefined) {
				questionObj.is_phone = 0
			} else {
				questionObj.is_phone = params.is_phone;
			}
			
			if (params.is_decimal === undefined) {
				questionObj.is_decimal = 0
			} else {
				questionObj.is_decimal = params.is_decimal;
			}

			if (params.is_readonly === undefined) {
				questionObj.is_readonly = 0
			} else {
				questionObj.is_readonly = params.is_readonly;
			}
			if (params.is_arithmetic === undefined) {
				questionObj.is_arithmetic = 0
			} else {
				questionObj.is_arithmetic = params.is_arithmetic;
			}
			if (params.operation_id) {
				questionObj.operation_id = params.operation_id;
			}
			if (params.is_dependent === undefined) {
				questionObj.is_dependent = 0;
			} else {
				questionObj.is_dependent = params.is_dependent;
			}
			if (params.is_child_question === undefined) {
				questionObj.is_child_question = 0;
			} else {
				questionObj.is_child_question = params.is_child_question;
			}
			if (params.is_mandatory === undefined) {
				questionObj.is_mandatory = 0
			} else {
				questionObj.is_mandatory = params.is_mandatory;
			}
			if (params.min !== undefined && params.min !== "") {
				questionObj.min = params.min;

			}
			if (params.max !== undefined && params.max !== "") {
				questionObj.max = params.max;
			}
			if (params.percentage_configuaration_id) {
				questionObj.percentage_configuaration_id = params.percentage_configuaration_id;

			}
			if (params.point) {
				questionObj.point = params.point;
			}
			if (params.dependent_question_id) {
				questionObj.dependent_question_id = params.dependent_question_id;
			}
			if (params.question_group_id) {
				questionObj.question_group_id = params.question_group_id;
			}


			let operand_id;

			if (params.is_arithmetic !== undefined) {
				if (params.question_operands) {

					let idgenObj = {
						name: "operand",
						status: 1
					}
					let idGenData = await IdGenerator.create(idgenObj)
						.catch(err => console.log(err));

					operand_id = idGenData.dataValues.id;

					await Promise.all(params.question_operands.map(async (item) => {
						let obj = {
							question_id: item.id,
							operand_id: operand_id,
							status: 1
						}
						let operandData = await QuestionOperand.create(obj)
							.catch(err => console.log(err))
					}))
				} else {
					return res.send({
						success: 0,
						message: "Question Creation Failed..! Operands array is empty "
					});
				}
			}

			questionObj.operand_id = operand_id ? operand_id : null;


			let data = await Question.create(questionObj)
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Error while creating a Question',
						error: err
					})

				})

			if (params.question_options) {
				let questionOptionArray = [];
				let questionId = data.dataValues.id;
				await Promise.all(params.question_options.map(async (item) => {
					let obj = {};
					obj.question_id = questionId;
					obj.name_en = item.name_en;
					obj.name_ml = item.name_ml;
					obj.points = item.points ? item.points : 0;
					obj.sort_order = item.sort_order ? item.sort_order : 0;
					obj.question_group_id = item.question_group_id ? item.question_group_id : null;

					if (item.child_question_id) {
						obj.child_question_id = item.child_question_id
					}
					obj.status = 1;
					questionOptionArray.push(obj);
				}));
				let surveyAnswerArray = await QuestionOption.bulkCreate(questionOptionArray)
				// .catch(err => {
				// 	return res.send({
				// 		success: 0,
				// 		message: 'Something went wrong while creating question option',
				// 		error: err
				// 	})

				// })
				return res.status(200).send({
					success: 1,
					id: data.dataValues.id,
					message: "Question created successfully."
				});

			} else {
				return res.status(200).send({
					success: 1,
					id: data.dataValues.id,
					message: "Question created successfully."
				});
			}

		},

		this.updateQuestion = async (req, res) => {
			let questionId = req.params.id;
			let params = req.body;
			let update = {};
			let operandId = params.operand_id;
			update.modified_at = new Date();
			update.status = 1;
			var options = params.question_options;
			options = options ? options : [];

			console.log("Options are " + JSON.stringify(options));

			if (!params.question_en && !params.question_ml &&
				!params.point && (params.is_percentage_calculation === undefined)
				&& (params.is_mandatory === undefined) && (params.is_child_question === undefined) && !params.type
				&& (params.min === undefined) && (params.max === undefined)
				&& !params.error_message && !params.percentage_configuaration_id
				&& !params.sort_order) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}
			update = params;
			if (params.question_en) {
				update.question_en = params.question_en.trim()
			}
			if (params.question_ml) {
				update.question_ml = params.question_ml.trim()
			}
			if (params.error_message) {
				update.error_message = params.error_message.trim()
			}
			if (params.type) {
				update.type = params.type.trim()
			}

			params.question_group_id = params.question_group_id ? params.question_group_id : null;

			update.question_group_id = params.question_group_id;

			if (params.is_readonly === undefined) {
				update.is_readonly = 0
			} else {
				update.is_readonly = params.is_readonly;
			}
			if (params.is_arithmetic === undefined) {
				update.is_arithmetic = 0
			} else {
				update.is_arithmetic = params.is_arithmetic;
			}
			if (params.operation_id) {
				update.operation_id = params.operation_id;
			}
			if (params.is_decimal) {
				update.is_decimal = params.is_decimal;
			}else{
				update.is_decimal=0;
			}
			if (params.operand_id) {
				update.operand_id = params.operand_id;
			}

			let idData = await Question.findOne({
				where: {
					id: questionId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking question id exists or not',
						error: err
					})
				})
			if (!idData) {
				return res.send({
					success: 0,
					message: 'Invalid question id'
				})
			} else {

				let existingOptions = [];
				existingOptions = await QuestionOption.findAll({
					where: {
						question_id: questionId,
						status: 1
					}
				}).catch(err => {
					return {
						success: 0,
						message: 'Something went wrong while updating question',
						error: err
					};
				});

				let i = 0;
				let ln = options.length;
				let optionData;
				let opId;
				var optionIdsSent = {};
				while (i < ln) {
					optionData = options[i];
					optionData.status = 1;
					optionData.question_group_id = optionData.question_group_id ? optionData.question_group_id : null;

					opId = optionData.id;
					//optionIdsSent.push(opId);
					optionIdsSent[opId] = 1;
					if (opId) {
						delete optionData.id;
						QuestionOption.update(optionData, {
							where: {
								id: opId
							}
						})
							.catch(err => {
								console.log("Error 5218:");
								console.log(JSON.stringify(err));
							});

					} else {
						optionData.question_id = questionId;
						optionData.child_question_id = optionData.child_question_id ? optionData.child_question_id : null;
						optionData.sort_order = optionData.sort_order ? optionData.sort_order : 0;
						QuestionOption.create(optionData)
							.catch(err => {
								console.log("Error 5218:");
								console.log(JSON.stringify(err));
							});
					}
					i++;
				}



				var opIdsToDelete = [];
				i = 0;
				if (!existingOptions.error) {
					ln = existingOptions.length;
					console.log("Existing options count " + ln);
					console.log("Sent optionIds: " + JSON.stringify(optionIdsSent));
					while (i < ln) {
						optionData = existingOptions[i];
						opId = optionData.id;
						console.log("Checking whether opId " + opId + " need to be deleted or not");
						if (!optionIdsSent[opId]) {
							console.log("Op id " + opId + " need to be deleted");
							optionData.status = 0;
							console.log("Updating qn option " + JSON.stringify(optionData));
							await QuestionOption.update({ status: 0 }, {
								where: {
									id: opId
								}
							})
								.catch(err => {
									console.log("Error 5218:");
									console.log(JSON.stringify(err));
								});
						} else {
							console.log("No need delete op id " + opId);
						}
						i++;
					}
				}

				if (params.hasOwnProperty('is_arithmetic') && params.is_arithmetic) {
					if (params.question_operands) {

						await QuestionOperand.update({ status: 0 }, {
							where: {
								operand_id: operandId,
								status: 1
							}
						}).catch(err => {
							console.log(JSON.stringify(err));
						});



						await Promise.all(params.question_operands.map(async (item) => {
							let obj = {
								question_id: item.id,
								operand_id: operandId,
								status: 1
							}


							let operandData = await QuestionOperand.create(obj)
								.catch(err => console.log(err))
						}))
					} else {
						return res.send({
							success: 0,
							message: "Question Creation Failed..! Operands array is empty "
						});
					}
				}



				await Question.update(update, {
					where: {
						id: questionId
					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating question',
							error: err
						})
					});
				res.status(200).send({
					success: 1,
					message: "Question updated successfully."
				});
			}


		},


		this.listQuestion = async (req, res) => {
			let params = req.query;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			whereCondition.status = 1;
			if (params.is_child_question) {
				whereCondition.is_child_question = params.is_child_question;
			}
			// if(params.name){
			//   whereCondition.name_en = {
			//     [Op.like]: '%' + params.name + '%'
			//   };
			//   // whereCondition.name_ml = {
			//   //   [Op.like]: '%' + params.name + '%'
			//   // };
			// }
			if (params.keyword) {
				let question_en = {
					[Op.like]: '%' + params.keyword + '%',
				};
				let question_ml = {
					[Op.like]: '%' + params.keyword + '%'
				};
				whereCondition = Sequelize.or({ question_en }, { question_ml })
			}
			var questionData = await Question.findAll({
				// raw: true,
				order: [
					['modified_at', 'DESC']
				],
				offset: offset,
				where: whereCondition,

				include: [{
					required: false,
					model: QuestionOption,
					as: 'question_options',
					// attributes: ['id','name_en','question_id','points','child_question_id','name_ml','sort_order','question_group_id'],
					where: {
						status: 1
					}
				}],
				// where: {
				//   status: 1
				// },

				limit: perPage,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching question data',
						error: err
					})
				});

			var count = await Question.count({
				where: whereCondition,

			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching question count data',
						error: err
					})
				});

			totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: questionData,
				total_items: count,
				has_next_page: hasNextPage,
				total_pages: totalPages,
				page,
				per_page: perPage,
				message: "Question data listed successfully",
				success: 1,
			}
			return res.send(response);
		},
		this.getQuestion = async (req, res) => {
			let questionId = req.params.id;

			let questionData = await Question.findOne({
				where: {
					id: questionId,
					status: 1
				},
				include: [{
					required: false,
					model: QuestionOption,
					as: 'question_options',
					attributes: ['id', 'name_en', 'name_ml', 'points', 'child_question_id', 'sort_order', 'question_group_id'],
					where: {
						status: 1
					}
				}, {
					required: false,
					model: QuestionOperand,
					as: 'question_operands',
					attributes: [['question_id', 'id']],
					where: {
						status: 1
					}
				}
				]
			}
			)
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting question data',
						error: err
					})
				})

			let response = {
				question: questionData,
				success: 1,
			}
			return res.send(response);
		},
		this.deleteQuestion = async (req, res) => {
			let questionId = req.params.id;
			let questionData = await Question.findOne({
				where: {
					id: questionId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting question data',
						error: err
					})
				})
			if (questionData) {

				if (questionData.is_arithmetic) {
					await QuestionOperand.update({ status: 0 }, {
						where: {
							operand_id: questionData.operand_id
						}
					}).catch(err => {
						console.log(JSON.stringify(err));
					});
				}


				let update = {
					status: 0
				}
				await Question.update(update, {
					where: {
						id: questionData.id

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while deleting question',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Question deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "Question not exists."
				});
			}


		},

		this.createQuestionOption = async (req, res) => {
			let params = req.body;

			if (!params.name_en || !params.name_ml ||
				params.points === undefined ||
				//  !params.field_name ||
				!params.question_id ||
				!params.value ||
				!params.sort_order) {
				var errors = [];
				if (!params.name_en) {
					errors.push({
						field: "name_en",
						message: "Name in English cannot be empty"
					});
				}
				if (!params.name_ml) {
					errors.push({
						field: "name_ml",
						message: "Name in Malayalam cannot be empty"
					});
				}
				// if (!params.field_name) {
				// 	errors.push({
				// 		field: "field_name",
				// 		message: "Field name in Malayalam cannot be empty"
				// 	});
				// }
				if (params.points === undefined) {
					errors.push({
						field: "point",
						message: "Point cannot be empty"
					});
				}
				if (!params.question_id) {
					errors.push({
						field: "question_id",
						message: "Question ID cannot be empty"
					});
				}
				// if (!params.type) {
				// 	errors.push({
				// 		field: "type",
				// 		message: "Type cannot be empty"
				// 	});
				// }

				if (!params.value) {
					errors.push({
						field: "value",
						message: "Value cannot be empty"
					});
				}
				if (!params.sort_order) {
					errors.push({
						field: "sort_order",
						message: "Sort order cannot be empty"
					});
				}
				return res.send({
					success: 0,
					statusCode: 400,
					errors: errors,
				});
			};

			let questionOptionObj = {
				name_en: params.name_en.trim(),
				name_ml: params.name_ml.trim(),
				// field_name: params.field_name.trim(),
				points: params.points,
				value: params.value,
				// type: params.type.trim(),
				sort_order: params.sort_order,
				status: 1
			}
			if (params.child_question_id) {
				questionOptionObj.child_question_id = params.child_question_id
			}
			let questionData = await Question.findOne({
				where: {
					id: params.question_id
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking  question id exists or not',
						error: err
					})

				})
			if (!questionData) {
				return res.send({
					success: 0,
					message: "Invalid question id "
				})
			} else {
				questionOptionObj.question_id = params.question_id;

			}
			if (params.child_question_id) {
				let dependentData = await Question.findOne({
					where: {
						id: params.child_question_id
					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while checking child question id exists or not',
							error: err
						})

					})
				if (!dependentData) {
					return res.send({
						success: 0,
						message: "Invalid child question id "
					})
				} else {
					questionOptionObj.dependent_question_id = params.dependent_question_id;

				}
			}
			try {
				let data = await QuestionOption.create(questionOptionObj);
				res.status(200).send({
					success: 1,
					id: data.dataValues.id,
					message: "Question option created successfully."
				});
			} catch (err) {
				console.log(err);
				return res.send({
					success: 0,
					message: 'Error while creating a Question option'
				})
			}
		},

		this.updateQuestionOption = async (req, res) => {
			let questionOptionId = req.params.id;
			let params = req.body;
			let update = {};
			update.modified_at = new Date();
			update.status = 1;

			if (!params.name_en && !params.name_ml &&
				params.points === undefined
				&& !params.question_id && !params.type &&
				!params.value &&
				!params.dependent_question_id &&
				!params.sort_order) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}
			if (params.name_en) {
				update.name_en = params.name_en.trim()
			}
			if (params.name_ml) {
				update.name_ml = params.name_ml.trim()
			}
			if (params.points !== undefined) {
				update.points = params.points
			}

			if (params.question_id) {
				let questionData = await Question.findOne({
					where: {
						id: params.question_id
					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while checking  question id exists or not',
							error: err
						})

					})
				if (!questionData) {
					return res.send({
						success: 0,
						message: "Invalid question id "
					})
				} else {
					update.question_id = params.question_id;

				}
			}
			if (params.value) {
				update.value = params.value
			}
			// if (params.fieldName) {
			// 	update.field_name = params.fieldName
			// }
			if (params.sortOrder) {
				update.sort_order = params.sortOrder
			}
			if (params.child_question_id) {
				let dependentData = await Question.findOne({
					where: {
						id: params.child_question_id
					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while checking child question id exists or not',
							error: err
						})

					})
				if (!dependentData) {
					return res.send({
						success: 0,
						message: "Invalid chils question id "
					})
				} else {
					update.child_question_id = params.child_question_id;

				}
			}

			let idData = await QuestionOption.findOne({
				where: {
					id: questionOptionId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking question id exists or not',
						error: err
					})
				})
			if (!idData) {
				return res.send({
					success: 0,
					message: 'Invalid question id'
				})
			} else {


				await QuestionOption.update(update, {
					where: {
						id: questionOptionId
					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating question option id',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Question option updated successfully."
				});
			}


		},


		this.listQuestionOption = async (req, res) => {
			let params = req.query;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			whereCondition.status = 1;
			// if(params.name){
			//   whereCondition.name_en = {
			//     [Op.like]: '%' + params.name + '%'
			//   };
			//   // whereCondition.name_ml = {
			//   //   [Op.like]: '%' + params.name + '%'
			//   // };
			// }
			if (params.keyword) {
				let name_en = {
					[Op.like]: '%' + params.keyword + '%',
				};
				let name_ml = {
					[Op.like]: '%' + params.keyword + '%'
				};
				whereCondition = Sequelize.or({ name_en }, { name_ml })
			}
			if (!params.question_id) {
				return res.send({
					success: 0,
					message: 'Please specify question id'
				})
			} else {
				whereCondition.question_id = params.question_id
			}
			var questionOptionData = await QuestionOption.findAll({
				// raw: true,
				order: [
					['modified_at', 'DESC']
				],
				offset: offset,
				where: whereCondition,
				// where: {
				//   status: 1
				// },

				limit: perPage,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching question option data',
						error: err
					})
				});

			var count = await QuestionOption.count({
				where: whereCondition,

			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching question option count data',
						error: err
					})
				});

			totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: questionOptionData,
				total_items: count,
				has_next_page: hasNextPage,
				total_pages: totalPages,
				page,
				per_page: perPage,
				message: "Question option data listed successfully",
				success: 1,
			}
			return res.send(response);
		},
		this.getQuestionOption = async (req, res) => {
			let questionOptionId = req.params.id;
			let questionOptionData = await QuestionOption.findOne({
				where: {
					id: questionOptionId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting question option data',
						error: err
					})
				})
			let response = {
				questionOption: questionOptionData,
				success: 1,
			}
			return res.send(response);
		},
		this.deleteQuestionOption = async (req, res) => {
			let questionOptionId = req.params.id;
			let questionOptionData = await QuestionOption.findOne({
				where: {
					id: questionOptionId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting question option data',
						error: err
					})
				})
			if (questionOptionData) {
				let update = {
					status: 0
				}
				await QuestionOption.update(update, {
					where: {
						id: questionOptionData.id

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while deleting question option',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Question option deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "Question option  not exists."
				});
			}


		},


		this.login = async (req, res) => {
			var username = req.body.username;
			var password = req.body.password;
			if (!username || !password) {
				var errors = [];
				if (!username) {
					errors.push({
						field: "username",
						message: "username cannot be empty"
					});
				}
				if (!password) {
					errors.push({
						field: "password",
						message: "Password cannot be empty"
					});
				}
				return res.send({
					success: 0,
					statusCode: 400,
					errors: errors,
				});
			};

			let findCriteria = {};


			let emailObj = {
				email: username,
			};
			let phoneObj = {
				phone: username
			};
			findCriteria = Sequelize.or(emailObj, phoneObj)

			findCriteria.status = 1;
			let userData = await User.findOne({
				where: findCriteria
			});
			if (!userData || userData.user_type == 'data_collection_section_user') {
				return res.send({
					success: 0,
					statusCode: 401,
					message: 'Incorrect phone or email'
				})
			};
			let matched = await bcrypt.compare(password, userData.password);
			if (matched) {


				var payload = {
					id: userData.id,
					name: userData.name,
					email: userData.email,
					phone: userData.phone,
					user_type: userData.user_type,
				};

				if (userData.district_id && userData.district_id != null) {
					payload.district_id = userData.district_id;
				}
				if (userData.lsgi_id && userData.lsgi_id != null) {
					payload.lsgi_id = userData.lsgi_id;
				}
				if (userData.lsgi_block_id && userData.lsgi_block_id != null) {
					payload.lsgi_block_id = userData.lsgi_block_id;
				}
				if(userData.lsgi && userData.lsgi_block_id!=null){
					payload.lsgi_block_id=userData.lsgi_block_id;
				}
                if(userData.lsgi_type_id && userData.lsgi_type_id!=null){
                    payload.lsgi_type_id=userData.lsgi_type_id;
                }
	

				
				var permissionsToken = jwt.sign({
					data: payload,
				}, JWT_KEY, {
					expiresIn: '10h'
				});
				
					return res.send({
						success: 1,
						statusCode: 200,
						
						token: permissionsToken,
						userDetails: payload,
						// permissions : permissions.items,
						message: 'Successfully logged in'
					})
					
			} else {
				return res.send({
					success: 0,
					statusCode: 401,
					message: 'Incorrect password'
				})
			}
		}






	this.createFacilityType = async (req, res) => {
		let params = req.body;

		if (!params.name_ml || !params.name_en || !params.category_id) {
			var errors = [];

			if (!params.name_ml) {
				errors.push({
					field: "name_ml",
					message: 'Require district Malayalam name'

				});
			}
			if (!params.name_en) {
				errors.push({
					field: "name_en",
					message: 'Require district English name'
				});
			}
			if (!params.category_id) {
				errors.push({
					field: "category_id",
					message: 'Require category id'
				});
			}
			return res.send({
				success: 0,
				statusCode: 400,
				errors: errors,
			});
		};


		let districtObj = {
			name_ml: params.name_ml.trim(),
			name_en: params.name_en.trim(),
			category_id: params.category_id,
			status: 1
		}
		let nameMlCheck = await FacilityType.findOne({
			where: {
				name_ml: params.name_ml,
				status: 1
			}
		})
			.catch(err => {
				return res.send({
					success: 0,
					message: 'Something went wrong while checking malayalam facility type name exists or not',
					error: err
				})
			})
		if (nameMlCheck) {
			return res.send({
				success: 0,
				message: 'Facility type malayalam name already exists..'
			})
		}

		let nameEnCheck = await FacilityType.findOne({
			where: {
				name_en: params.name_en,
				status: 1
			}
		})
			.catch(err => {
				return res.send({
					success: 0,
					message: 'Something went wrong while checking english facility type name exists or not',
					error: err
				})
			})
		if (nameEnCheck) {
			return res.send({
				success: 0,
				message: 'District english name already exists..'
			})
		}

		let categoryCheck = await Category.findOne({
			where: {
				id: params.category_id,
				status: 1
			}
		})
			.catch(err => {
				return res.send({
					success: 0,
					message: 'Something went wrong while checking category id exists or not',
					error: err
				})
			})
		if (!categoryCheck) {
			return res.send({
				success: 0,
				message: 'Invalid category Id..'
			})
		}
		try {
			let data = await FacilityType.create(districtObj);

			res.status(200).send({
				success: 1,
				id: data.dataValues.id,
				message: "Facility type created successfully."
			});
		} catch (err) {
			console.log(err);
			return res.send({
				success: 0,
				message: 'Error while create a facility type'
			})
		}
	},
		this.updateFacilityType = async (req, res) => {
			let facilityTypeId = req.params.id;
			let update = {};
			update.modified_at = new Date();
			update.status = 1;
			if (!req.body.name_ml && !req.body.name_en && !req.body.category_id) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}
			if (req.body.name_ml) {
				update.name_ml = req.body.name_ml.trim();
			}
			if (req.body.name_en) {
				update.name_en = req.body.name_en.trim();
			}
			if (req.body.category_id) {
				update.category_id = req.body.category_id;
			}
			let idData = await FacilityType.findOne({
				where: {
					id: facilityTypeId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking facility type id exists or not',
						error: err
					})
				})
			if (!idData) {
				return res.send({
					success: 0,
					message: 'Invalid Facility type '
				})
			} else {
				if (req.body.name_en) {
					let nameEnData = await FacilityType.findOne({
						where: {
							name_en: req.body.name_en,
							status: 1,
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking English FacilityType name already exists or not',
								error: err
							})
						})
					if (nameEnData && (nameEnData.id !== facilityTypeId)) {
						return res.send({
							success: 0,
							message: 'Facility Type English name already exists '
						})
					}
				}

				if (req.body.name_ml) {
					let nameMlData = await FacilityType.findOne({
						where: {
							name_ml: req.body.name_ml,
							status: 1,
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking malayalam facilityType name already exists or not',
								error: err
							})
						})
					if (nameMlData && (nameMlData.id !== facilityTypeId)) {
						return res.send({
							success: 0,
							message: 'District Malayalam name already exists '
						})
					}
				}
				if (req.body.category_id) {
					let categoryCheck = await Category.findOne({
						where: {
							id: req.body.category_id,
							status: 1
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking category id exists or not',
								error: err
							})
						})
					if (!categoryCheck) {
						return res.send({
							success: 0,
							message: 'Invalid category Id..'
						})
					}
				}

				await FacilityType.update(update, {
					where: {
						id: facilityTypeId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating facilityType name',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Facility type updated successfully."
				});
			}


		},
		this.listFacilityType = async (req, res) => {
			let params = req.query;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			whereCondition.status = 1;
			if (params.name) {
				whereCondition.name_en = {
					[Op.like]: '%' + params.name + '%'
				};
				// whereCondition.name_ml = {
				//   [Op.like]: '%' + params.name + '%'
				// };
			}
			if (params.keyword) {
				let name_en = {
					[Op.like]: '%' + params.keyword + '%',
				};
				let name_ml = {
					[Op.like]: '%' + params.keyword + '%'
				};
				whereCondition = Sequelize.or({ name_en }, { name_ml })
			}

			var facilityTypeData = await FacilityType.findAll({
				// raw: true,
				order: [
					['modified_at', 'DESC']
				],
				offset: offset,
				where: whereCondition,
				include: [{
					model: Category
				}],
				// where: {
				//   status: 1
				// },
				limit: perPage,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching facility type data',
						error: err
					})
				});

			var count = await FacilityType.count({
				where: whereCondition,

			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching facility type  count data',
						error: err
					})
				});

			totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: facilityTypeData,
				total_items: count,
				has_next_page: hasNextPage,
				total_pages: totalPages,
				page,
				per_page: perPage,
				message: "Facility Types listed successfully",
				success: 1,
			}
			return res.send(response);
		},


		this.getFacilityType = async (req, res) => {
			let facilityTypeId = req.params.id;
			let facilityTypeData = await FacilityType.findOne({
				where: {
					id: facilityTypeId,
					status: 1
				},
				include: [{
					model: Category
				}]
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting FacilityType data',
						error: err
					})
				})
			let response = {
				facilityType: facilityTypeData,
				success: 1,
			}
			return res.send(response);
		},
		this.deleteFacilityType = async (req, res) => {
			let facilityTypeId = req.params.id;
			let facilityTypeData = await FacilityType.findOne({
				where: {
					id: facilityTypeId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting FacilityType data',
						error: err
					})
				})
			if (facilityTypeData) {
				let update = {
					status: 0
				}
				await FacilityType.update(update, {
					where: {
						id: facilityTypeId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while deleting FacilityType',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "FacilityType deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "FacilityType not exists."
				});
			}


		},


		this.createFacilitySurveyQuestion = async (req, res) => {
			let params = req.body;

			if (!params.question_en || !params.question_ml || !params.type) {
				var errors = [];

				if (!params.question_en) {
					errors.push({
						field: "question_en",
						message: 'Require question in English'

					});
				}

				if (!params.question_ml) {
					errors.push({
						field: "question_ml",
						message: 'Require question in Malayalam'

					});
				}

				// if (!params.field_name) {
				// 	errors.push({
				// 		field: "field_name",
				// 		message: 'Require field name'
				// 	});
				// }
				if (!params.type) {
					errors.push({
						field: "type",
						message: 'Require type'
					});
				}


				return res.send({
					success: 0,
					statusCode: 400,
					errors: errors,
				});
			};

			params.question_group_id = params.question_group_id ? params.question_group_id : null;

			let facilitySurveyQuestionObj = {
				question_en: params.question_en.trim(),
				question_ml: params.question_ml.trim(),
				field_name: params.field_name.trim(),
				type: params.type.trim(),
				question_group_id: params.question_group_id,
				status: 1
			}

			// let questionEnCheck = await FacilitySurveyQuestion.findOne({
			// 	where: {
			// 		question_en: params.question_en.trim(),
			// 		status: 1
			// 	}
			// })
			// 	.catch(err => {
			// 		return res.send({
			// 			success: 0,
			// 			message: 'Something went wrong while checking question english exists or not',
			// 			error: err
			// 		})
			// 	})
			// if (questionEnCheck) {
			// 	return res.send({
			// 		success: 0,
			// 		message: 'Question English already exists..'
			// 	})
			// }

			// let questionMlCheck = await FacilitySurveyQuestion.findOne({
			// 	where: {
			// 		question_ml: params.question_ml.trim(),
			// 		status: 1
			// 	}
			// })
			// 	.catch(err => {
			// 		return res.send({
			// 			success: 0,
			// 			message: 'Something went wrong while checking question malayalam exists or not',
			// 			error: err
			// 		})
			// 	})
			// if (questionMlCheck) {
			// 	return res.send({
			// 		success: 0,
			// 		message: 'Question Malayalam already exists..'
			// 	})
			// }

			// let fieldNameCheck = await FacilitySurveyQuestion.findOne({
			// 	where: {
			// 		field_name: params.field_name.trim(),
			// 		status: 1
			// 	}
			// })
			// 	.catch(err => {
			// 		return res.send({
			// 			success: 0,
			// 			message: 'Something went wrong while checking field name exists or not',
			// 			error: err
			// 		})
			// 	})
			// if (fieldNameCheck) {
			// 	return res.send({
			// 		success: 0,
			// 		message: 'Field name already exists..'
			// 	})
			// }
			if (params.is_decimal === undefined) {
				facilitySurveyQuestionObj.is_decimal = 0
			} else {
				facilitySurveyQuestionObj.is_decimal = params.is_decimal;
			}

			let data = await FacilitySurveyQuestion.create(facilitySurveyQuestionObj)
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Error while creating a FacilitySurveyQuestion',
						error: err
					})

				})

			if (params.question_options) {
				let questionOptionArray = [];
				let questionId = data.dataValues.id;
				await Promise.all(params.question_options.map(async (item) => {
					let obj = {};
					obj.facility_survey_question_id = questionId;
					obj.option_name_en = item.option_name_en;
					obj.option_name_ml = item.option_name_ml;
					obj.facility_type_id = item.facility_type_id;
					if (obj.facility_type_id) {
						let dat = await FacilityType.findOne({
							where: {
								status: 1,
								id: obj.facility_type_id
							},
							attributes: ['name_en', 'name_ml']
						})
							.catch(err => console.log(err))
						if (dat) {

							obj.option_name_ml = dat.name_ml;
							obj.option_name_en = dat.name_en;
						}
					}
					obj.sort_order = item.sort_order ? item.sort_order : 0;

					if (item.question_group_id) {
						obj.question_group_id = item.question_group_id
					}
					obj.status = 1;
					questionOptionArray.push(obj);
				}));
				let surveyAnswerArray = await FacilitySurveyQuestionOption.bulkCreate(questionOptionArray)

				return res.status(200).send({
					success: 1,
					id: data.dataValues.id,
					message: "FacilitySurveyQuestion created successfully."
				});
			} else {
				return res.status(200).send({
					success: 1,
					id: data.dataValues.id,
					message: "FacilitySurveyQuestion created successfully."
				});
			}


		},


		this.updateFacilitySurveyQuestion = async (req, res) => {
			let facilitySurveyQuestionId = req.params.id;
			let update = {};
			update.modified_at = new Date();
			update.status = 1;

			req.body.question_options.question_group_id = req.body.question_options.question_group_id ? req.body.question_options.question_group_id : null;

			var options = req.body.question_options;
			options = options ? options : [];

			console.log("Options are " + JSON.stringify(options));

			if (!req.body.question_en && req.body.question_ml && !req.body.field_name && !req.body.type) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}
			if (req.body.question_en) {
				update.question_en = req.body.question_en.trim();
			}
			if (req.body.question_ml) {
				update.question_ml = req.body.question_ml.trim();
			}
			if (req.body.field_name) {
				update.field_name = req.body.field_name.trim();
			}
			if (req.body.type) {
				update.type = req.body.type.trim();
			}
			if(req.body.is_decimal){
				update.is_decimal=req.body.is_decimal;
			}else{
				update.is_decimal=0
			}

			req.body.question_group_id = req.body.question_group_id ? req.body.question_group_id : null;

			update.question_group_id = req.body.question_group_id;



			let idData = await FacilitySurveyQuestion.findOne({
				where: {
					id: facilitySurveyQuestionId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking facilitySurveyQuestion exists or not',
						error: err
					})
				})

			if (!idData) {
				return res.send({
					success: 0,
					message: 'Invalid facilitySurveyQuestionId '
				})
			} else {

				// if (req.body.question_en) {
				// 	let facilitySurveyQuestionData = await FacilitySurveyQuestion.findOne({
				// 		where: {
				// 			question_en: req.body.question_en,
				// 			status: 1,
				// 		}
				// 	})
				// 		.catch(err => {
				// 			return res.send({
				// 				success: 0,
				// 				message: 'Something went wrong while checking question English already exists or not',
				// 				error: err
				// 			})
				// 		})
				// 	if (facilitySurveyQuestionData && (facilitySurveyQuestionData.id !== facilitySurveyQuestionId)) {
				// 		return res.send({
				// 			success: 0,
				// 			message: 'Question English already exists '
				// 		})
				// 	}
				// }

				// if (req.body.question_ml) {
				// 	let facilitySurveyQuestionData = await FacilitySurveyQuestion.findOne({
				// 		where: {
				// 			question_ml: req.body.question_ml,
				// 			status: 1,
				// 		}
				// 	})
				// 		.catch(err => {
				// 			return res.send({
				// 				success: 0,
				// 				message: 'Something went wrong while checking question Malayalam already exists or not',
				// 				error: err
				// 			})
				// 		})
				// 	if (facilitySurveyQuestionData && (facilitySurveyQuestionData.id !== facilitySurveyQuestionId)) {
				// 		return res.send({
				// 			success: 0,
				// 			message: 'Question Malayalam already exists '
				// 		})
				// 	}
				// }


				// if (req.body.field_name) {
				// 	let facilitySurveyQuestionData = await FacilitySurveyQuestion.findOne({
				// 		where: {
				// 			field_name: idData.dataValues.field_name,
				// 			status: 1,
				// 		}
				// 	})
				// 		.catch(err => {
				// 			return res.send({
				// 				success: 0,
				// 				message: 'Something went wrong while checking field name already exists or not',
				// 				error: err
				// 			})
				// 		})
				// 	if (facilitySurveyQuestionData && (facilitySurveyQuestionData.id !== facilitySurveyQuestionId)) {
				// 		return res.send({
				// 			success: 0,
				// 			message: 'Field name already exists '
				// 		})
				// 	}
				// }



				//
				let existingOptions = [];
				existingOptions = await FacilitySurveyQuestionOption.findAll({
					where: {
						facility_survey_question_id: facilitySurveyQuestionId,
						status: 1
					}
				}).catch(err => {
					return {
						success: 0,
						message: 'Something went wrong while updating question',
						error: err
					};
				});

				let i = 0;
				let ln = options.length;
				let optionData;
				let opId;
				var optionIdsSent = {};
				while (i < ln) {
					optionData = options[i];
					optionData.status = 1;
					opId = optionData.id;
					optionData.question_group_id = optionData.question_group_id ? optionData.question_group_id : null;

					if (optionData.facility_type_id) {
						let dat = await FacilityType.findOne({
							where: {
								status: 1,
								id: optionData.facility_type_id
							},
							attributes: ['name_en', 'name_ml']
						})
							.catch(err => console.log(err))
						if (dat) {

							optionData.option_name_ml = dat.name_ml;
							optionData.option_name_en = dat.name_en;
						}
					}

					//optionIdsSent.push(opId);
					optionIdsSent[opId] = 1;
					if (opId) {
						delete optionData.id;
						FacilitySurveyQuestionOption.update(optionData, {
							where: {
								id: opId
							}
						})
							.catch(err => {
								console.log("Error 5218:");
								console.log(JSON.stringify(err));
							});

					} else {
						optionData.facility_survey_question_id = facilitySurveyQuestionId;
						// optionData.question_group_id = optionData.question_group_id ? optionData.question_group_id : null;
						optionData.sort_order = optionData.sort_order ? optionData.sort_order : 0;
						FacilitySurveyQuestionOption.create(optionData)
							.catch(err => {
								console.log("Error 5218:");
								console.log(JSON.stringify(err));
							});
					}
					i++;
				}


				var opIdsToDelete = [];
				i = 0;
				if (!existingOptions.error) {
					ln = existingOptions.length;
					console.log("Existing options count " + ln);
					console.log("Sent optionIds: " + JSON.stringify(optionIdsSent));
					while (i < ln) {
						optionData = existingOptions[i];
						opId = optionData.id;
						console.log("Checking whether opId " + opId + " need to be deleted or not");
						if (!optionIdsSent[opId]) {
							console.log("Op id " + opId + " need to be deleted");
							optionData.status = 0;
							console.log("Updating qn option " + JSON.stringify(optionData));
							await FacilitySurveyQuestionOption.update({ status: 0 }, {
								where: {
									id: opId
								}
							})
								.catch(err => {
									console.log("Error 5218:");
									console.log(JSON.stringify(err));
								});
						} else {
							console.log("No need delete op id " + opId);
						}
						i++;
					}
				}



				await FacilitySurveyQuestion.update(update, {
					where: {
						id: facilitySurveyQuestionId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating FacilitySurveyQuestion',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "FacilitySurveyQuestion updated successfully."
				});
			}


		},
		this.listFacilitySurveyQuestion = async (req, res) => {
			let params = req.query;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			whereCondition.status = 1;
			if (params.name) {
				whereCondition.name_en = {
					[Op.like]: '%' + params.name + '%'
				};
				// whereCondition.name_ml = {
				//   [Op.like]: '%' + params.name + '%'
				// };
			}
			if (params.keyword) {
				let question_en = {
					[Op.like]: '%' + params.keyword + '%',
				};
				let question_ml = {
					[Op.like]: '%' + params.keyword + '%'
				};
				whereCondition = Sequelize.or({ question_en }, { question_ml })
			}
			var facilitySurveyQuestionData = await FacilitySurveyQuestion.findAll({
				// raw: true,
				order: [
					['modified_at', 'DESC']
				],
				offset: offset,
				where: whereCondition,
				include: [{
					required: false,
					model: FacilitySurveyQuestionOption,
					as: 'facility_survey_question_options',
					attributes: ['id', 'option_name_en', 'option_name_ml', 'facility_survey_question_id', 'sort_order', 'question_group_id'],
					where: {
						status: 1
					}
				}],
				// where: {
				//   status: 1
				// },
				limit: perPage,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching facilitySurveyQuestion data',
						error: err
					})
				});

			var count = await FacilitySurveyQuestion.count({
				where: whereCondition,

			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching facilitySurveyQuestion count',
						error: err
					})
				});

			totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: facilitySurveyQuestionData,
				total_items: count,
				has_next_page: hasNextPage,
				total_pages: totalPages,
				page,
				per_page: perPage,
				message: "Facility Survey Question Data listed successfully",
				success: 1,
			}
			return res.send(response);
		},


		this.getFacilitySurveyQuestion = async (req, res) => {
			let facilitySurveyQuestionId = req.params.id;
			let facilitySurveyQuestionData = await FacilitySurveyQuestion.findOne({
				where: {
					id: facilitySurveyQuestionId,
					status: 1
				},
				include: [{
					required: false,
					model: FacilitySurveyQuestionOption,
					as: 'facility_survey_question_options',
					attributes: ['id', 'option_name_en', 'option_name_ml', 'sort_order', 'question_group_id', 'facility_type_id'],
					where: {
						status: 1
					}
				}]
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting facilitySurveyQuestionData data',
						error: err
					})
				})
			let response = {
				facility_survey_question: facilitySurveyQuestionData,
				success: 1,
			}
			return res.send(response);
		},
		this.deleteFacilitySurveyQuestion = async (req, res) => {
			let facilitySurveyQuestionId = req.params.id;
			let facilitySurveyQuestionData = await FacilitySurveyQuestion.findOne({
				where: {
					id: facilitySurveyQuestionId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting facilitySurveyQuestion data',
						error: err
					})
				})
			if (facilitySurveyQuestionData) {
				let update = {
					status: 0
				}
				await FacilitySurveyQuestion.update(update, {
					where: {
						id: facilitySurveyQuestionId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while deleting FacilitySurveyQuestion',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "FacilitySurveyQuestion deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "FacilitySurveyQuestion not exists."
				});
			}


		},

		this.createCategoryFacilitySurveyQuestion = async (req, res) => {
			let params = req.body;

			if ( !params.child_cat_id || !params.facility_survey_question_id
				|| !params.sort_order) {
				var errors = [];

				// if (!params.parent_cat_id) {
					// errors.push({
					// 	field: "parent_cat_id",
					// 	message: 'Require parent category id'

					// });
				// }
				if (!params.child_cat_id) {
					errors.push({
						field: "child_cat_id",
						message: 'Require child category id'

					});
				}

				if (!params.facility_survey_question_id) {
					errors.push({
						field: "facility_survey_question_id",
						message: 'Require facility survey question id'

					});
				}
				if (!params.sort_order) {
					errors.push({
						field: "sort_order",
						message: 'Require sort order'
					});
				}

				return res.send({
					success: 0,
					statusCode: 400,
					errors: errors,
				});
			};


			let categoryFacilitySurveyQuestionObj = {
				// parent_cat_id: params.parent_cat_id,
				child_cat_id: params.child_cat_id,
				facility_survey_question_id: params.facility_survey_question_id,
				sort_order: params.sort_order,
				status: 1
			}
			if(params.parent_cat_id){
			
			categoryFacilitySurveyQuestionObj.parent_cat_id = params.parent_cat_id ;
		
			let categoryCheck = await Category.findOne({
				where: {
					id: params.parent_cat_id,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while parent checking category',
						error: err
					})
				})
			if (!categoryCheck) {
				return res.send({
					success: 0,
					message: 'Invalid parent category id'
				})
			 }
			}		
			let categoryChildCheck = await Category.findOne({
				where: {
					id: params.child_cat_id,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking child category',
						error: err
					})
				})
			if (!categoryChildCheck) {
				return res.send({
					success: 0,
					message: 'Invalid child category id'
				})
			}

			let facilitySurveyQuestionCheck = await FacilitySurveyQuestion.findOne({
				where: {
					id: params.facility_survey_question_id,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking FacilitySurveyQuestion',
						error: err
					})
				})
			if (!facilitySurveyQuestionCheck) {
				return res.send({
					success: 0,
					message: 'Invalid facility survey question check'
				})
			}
			let whereCategoryFacilitySurveyQuest = {
						child_cat_id: params.child_cat_id,
						facility_survey_question_id: params.facility_survey_question_id,
						status: 1
			}
			if(params.parent_cat_id){
				whereCategoryFacilitySurveyQuest.parent_cat_id = params.parent_cat_id ;
			}
			let categoryFacilitySurveyQuestionCheck = await CategoryFacilitySurveyQuestion.findOne({
				where: whereCategoryFacilitySurveyQuest
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking CategoryFacilitySurveyQuestionCheck',
						error: err
					})
				})
			if (categoryFacilitySurveyQuestionCheck) {
				return res.send({
					success: 0,
					message: 'Already exists'
				})
			}

			try {
				
				let data = await CategoryFacilitySurveyQuestion.create(categoryFacilitySurveyQuestionObj);

				res.status(200).send({
					success: 1,
					id: data.dataValues.id,
					message: "CategoryFacilitySurveyQuestion created successfully."
				});
			} catch (err) {
				console.log(err);
				return res.send({
					success: 0,
					message: 'Error while create a CategoryFacilitySurveyQuestion'
				})
			}
		},
		this.updateCategoryFacilitySurveyQuestion = async (req, res) => {
			let categoryFacilitySurveyQuestionId = req.params.id;
			let update = {};
			update.modified_at = new Date();
			update.status = 1;
			if (!req.body.child_cat_id && !req.body.parent_cat_id && !req.body.facility_survey_question_id
				|| !req.body.sort_order) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}
			if (req.body.parent_cat_id) {
				update.parent_cat_id = req.body.parent_cat_id;
			}
			if (req.body.child_cat_id) {
				update.child_cat_id = req.body.child_cat_id;
			}
			if (req.body.facility_survey_question_id) {
				update.facility_survey_question_id = req.body.facility_survey_question_id;
			}
			if (req.body.sort_order) {
				update.sort_order = req.body.sort_order;
			}
			let idData = await CategoryFacilitySurveyQuestion.findOne({
				where: {
					id: categoryFacilitySurveyQuestionId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking categoryFacilitySurveyQuestionId',
						error: err
					})
				})
			if (!idData) {
				return res.send({
					success: 0,
					message: 'Invalid categoryFacilitySurveyQuestionId '
				})
			} else {
				let whereCondition = {}
				if (req.body.parent_cat_id) {
					let categoryCheck = await Category.findOne({
						where: {
							id: req.body.parent_cat_id,
							status: 1
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking parent category',
								error: err
							})
						})
					if (!categoryCheck) {
						return res.send({
							success: 0,
							message: 'Invalid parent category id'
						})
					}
				}
				if (req.body.child_cat_id) {
					let categoryChildCheck = await Category.findOne({
						where: {
							id: req.body.child_cat_id,
							status: 1
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking parent category',
								error: err
							})
						})
					if (!categoryChildCheck) {
						return res.send({
							success: 0,
							message: 'Invalid child category id'
						})
					}
				}

				if (req.body.facility_survey_question_id) {
					let facilitySurveyQuestionCheck = await FacilitySurveyQuestion.findOne({
						where: {
							id: req.body.facility_survey_question_id,
							status: 1
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking FacilitySurveyQuestion',
								error: err
							})
						})
					if (!facilitySurveyQuestionCheck) {
						return res.send({
							success: 0,
							message: 'Invalid facility survey question check'
						})
					}
				}

				if (req.body.facility_survey_question_id  && req.body.child_cat_id) {
					let whereStatement={
						child_cat_id : req.body.child_cat_id,
						facility_survey_question_id: req.body.facility_survey_question_id,
						status: 1
					}
					if(req.body.parent_cat_id){
						whereStatement.parent_cat_id = req.body.parent_cat_id;
					}

					let categoryFacilitySurveyQuestionData = await CategoryFacilitySurveyQuestion.findOne({
						where: whereStatement
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking CategoryFacilitySurveyQuestionCheck',
								error: err
							})
						})
					if (categoryFacilitySurveyQuestionData && (categoryFacilitySurveyQuestionData.id !== categoryFacilitySurveyQuestionId)) {
						return res.send({
							success: 0,
							message: 'Already exists'
						})
					}
				}

				await CategoryFacilitySurveyQuestion.update(update, {
					where: {
						id: categoryFacilitySurveyQuestionId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while CategoryFacilitySurveyQuestion',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "CategoryFacilitySurveyQuestion updated successfully."
				});
			}


		},
		this.listCategoryFacilitySurveyQuestion = async (req, res) => {
			let params = req.query;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			whereCondition.status = 1;
			if (params.name) {
				whereCondition.name_en = {
					[Op.like]: '%' + params.name + '%'
				};
				// whereCondition.name_ml = {
				//   [Op.like]: '%' + params.name + '%'
				// };
			}
			if (params.keyword) {
				let name_en = {
					[Op.like]: '%' + params.keyword + '%',
				};
				let name_ml = {
					[Op.like]: '%' + params.keyword + '%'
				};
				whereCondition = Sequelize.or({ name_en }, { name_ml })
			}
			var categoryFacilitySurveyQuestions = await CategoryFacilitySurveyQuestion.findAll({
				// raw: true,
				order: [
					['modified_at', 'DESC']
				],
				offset: offset,
				where: {
				  status: 1
				},
				include: [{
					model: Category,
					as:'parent_cat',
					where: whereCondition,
					required:false
				},
				{
					model: Category,
					as:'child_cat'
				}, {
					model: FacilitySurveyQuestion
				}],
				limit: perPage,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching categoryFacilitySurveyQuestion data',
						error: err
					})
				});

			var count = await CategoryFacilitySurveyQuestion.count({
				where: {
					status: 1
				  },
				  include: [{
					  model: Category,
					  as:'parent_cat',
					  where: whereCondition
				  },
				  {
					  model: Category,
					  as:'child_cat'
				  }, {
					  model: FacilitySurveyQuestion
				  }]

			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching categoryFacilitySurveyQuestions count data',
						error: err
					})
				});

			totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: categoryFacilitySurveyQuestions,
				total_items: count,
				has_next_page: hasNextPage,
				total_pages: totalPages,
				page,
				per_page: perPage,
				message: "CategoryFacilitySurveyQuestion listed successfully",
				success: 1,
			}
			return res.send(response);
		},


		this.getCategoryFacilitySurveyQuestion = async (req, res) => {
			let categoryFacilitySurveyQuestionId = req.params.id;
			let categoryFacilitySurveyQuestionData = await CategoryFacilitySurveyQuestion.findOne({
				where: {
					id: categoryFacilitySurveyQuestionId,
					status: 1
				},
				include: [{
					model: Category,
					as:'parent_cat'
				},
				{
					model: Category,
					as:'child_cat'
				}, {
					model: FacilitySurveyQuestion
				}]
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting categoryFacilitySurveyQuestion',
						error: err
					})
				})
			let response = {
				categoryFacilitySurveyQuestion: categoryFacilitySurveyQuestionData,
				success: 1,
			}
			return res.send(response);
		},
		this.deleteCategoryFacilitySurveyQuestion = async (req, res) => {
			let categoryFacilitySurveyQuestionId = req.params.id;
			let categoryFacilitySurveyQuestionData = await CategoryFacilitySurveyQuestion.findOne({
				where: {
					id: categoryFacilitySurveyQuestionId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting category facility survey question data',
						error: err
					})
				})
			if (categoryFacilitySurveyQuestionData) {
				let update = {
					status: 0,
					modified_at: new Date()
				}
				await CategoryFacilitySurveyQuestion.update(update, {
					where: {
						id: categoryFacilitySurveyQuestionData.id

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating CategoryFacilitySurveyQuestion',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "CategoryFacilitySurveyQuestion deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "CategoryFacilitySurveyQuestion not exists."
				});
			}


		},

		this.updateFacilitySurvey = async (req, res) => {
			let facilitySurveyId = req.params.id;
			let update = req.body;

			update.modified_at = new Date();
			update.status = 1;

			// if (!req.body.name_ml && !req.body.name_en) {
			// 	return res.send({
			// 		success: 0,
			// 		message: 'Nothing to update'
			// 	})
			// }
			// if (req.body.name_ml) {
			// 	update.name_ml = req.body.name_ml.trim();
			// }
			// if (req.body.name_en) {
			// 	update.name_en = req.body.name_en.trim();
			// }
			let idData = await FacilitySurvey.findOne({
				where: {
					id: facilitySurveyId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking facility survey id exists or not',
						error: err
					})
				})
			if (!idData) {
				return res.send({
					success: 0,
					message: 'Invalid facility survey '
				})
			} else {

				// 	let districtData = await District.findOne({
				// 			where: {
				// 				name_en: req.body.name_en,
				// 				status: 1,
				// 			}
				// 		})
				// 		.catch(err => {
				// 			return res.send({
				// 				success: 0,
				// 				message: 'Something went wrong while checking English district name already exists or not',
				// 				error: err
				// 			})
				// 		})
				// 	if (districtData && (districtData.id !== districtId)) {
				// 		return res.send({
				// 			success: 0,
				// 			message: 'District English name already exists '
				// 		})
				// 	}
				// }

				// if (req.body.name_ml) {
				// 	let districtData = await District.findOne({
				// 			where: {
				// 				name_ml: req.body.name_ml,
				// 				status: 1,
				// 			}
				// 		})
				// 		.catch(err => {
				// 			return res.send({
				// 				success: 0,
				// 				message: 'Something went wrong while checking malayalam district name already exists or not',
				// 				error: err
				// 			})
				// 		})
				// 	if (districtData && (districtData.id !== districtId)) {
				// 		return res.send({
				// 			success: 0,
				// 			message: 'District Malayalam name already exists '
				// 		})
				// 	}
				// }

				await FacilitySurvey.update(update, {
					where: {
						id: facilitySurveyId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating facility survey',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Facility survey updated successfully."
				});
			}


		},
		this.listFacilitySurvey = async (req, res) => {
			let params = req.query;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			whereCondition.status = 1;
			if (params.name) {
				whereCondition.name_en = {
					[Op.like]: '%' + params.name + '%'
				};
				// whereCondition.name_ml = {
				//   [Op.like]: '%' + params.name + '%'
				// };
			}
			if (params.date) {
				let chkdate = params.date;
				if (chkdate == null) {
					return res.send({
						success: 0,
						message: ` Date format should be in 'yyyy-mm-dd' .  `
					})
				}
				whereCondition.created_at = {
					[Op.lte]: new Date(),
					[Op.gte]: chkdate
				}
			}
			let categoryCondition = {};

			categoryCondition.status = 1;

			if (params.category_id) {
				let child_cat_id = {
					[Op.like]: '%' + params.category_id + '%',
				}
				let parent_cat_id = {
					[Op.like]: '%' + params.category_id + '%',
				}
				categoryCondition = Sequelize.or({ child_cat_id }, { parent_cat_id });
			}


			if (params.facility_type_id) {
				whereCondition.facility_type_id = params.facility_type_id
			}
			if (params.lsgi_id) {
				whereCondition.lsgi_id = params.lsgi_id
			}
			let lsgiCondition = {}
			lsgiCondition.status = 1;
			// if (params.district_id) {
			// 	lsgiCondition.district_id = params.district_id;
			// }

			let userDataz = req.identity.data;
			if (userDataz.district_id && userDataz.district_id != null) {
				lsgiCondition.district_id = userDataz.district_id;
			}
			if (userDataz.lsgi_id && userDataz.lsgi_id != null) {
				whereCondition.lsgi_id = userDataz.lsgi_id;
			}
			// if(userDataz.lsgi_block_id && userDataz.lsgi_block_id!=null){
			// 	whereCondition.lsgi_block_id=userDataz.lsgi_block_id;
			// }
			if (userDataz.ward_id && userDataz.ward_id != null) {
				whereCondition.ward_id = userDataz.ward_id;
			}


			var facilitySurveyData = await FacilitySurvey.findAll({
				// raw: true,
				order: [
					['modified_at', 'DESC']
				],
				offset: offset,
				where: whereCondition,
				// where: {
				//   status: 1
				// },
				include: [{
					model: Lsgi,
					where: lsgiCondition
					, include: [{
						model: LsgiType,
						where: { status: 1 }
					}]
				}, {
					model: CategoryRelationship,
					where: categoryCondition,
					include: [{
						model: Category,
						as: 'parent_category',
						attributes: ['id', 'name_en', 'name_ml']
					},
					{
						model: Category,
						as: 'child_category',
						attributes: ['id', 'name_en', 'name_ml']
					}]
				}
					, {
					model: Ward

				}, {

					model: District

				}, {
					model: User
				}
					, {
					model: FacilityType
				}
				],
				limit: perPage,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching facility survey data',
						error: err
					})
				});

			var count = await FacilitySurvey.count({
				include: [{
					model: Lsgi,
					where: lsgiCondition
				}, {
					model: CategoryRelationship,
					where: categoryCondition,
					include: [{
						model: Category,
						as: 'parent_category',
						attributes: ['id', 'name_en', 'name_ml']
					},
					{
						model: Category,
						as: 'child_category',
						attributes: ['id', 'name_en', 'name_ml']
					}]
				}
					, {
					model: Ward

				}, {
					model: User
				}
					, {
					model: FacilityType
				}
				],
				where: whereCondition


			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching facility survey count data',
						error: err
					})
				});

			totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: facilitySurveyData,
				total_items: count,
				has_next_page: hasNextPage,
				total_pages: totalPages,
				page,
				per_page: perPage,
				message: "Facility survey listed successfully",
				success: 1,
			}
			return res.send(response);
		},


		this.getFacilitySurvey = async (req, res) => {
			let facilitySurveyId = req.params.id;

			var categoryData = {
				child_category: null,
				parent_category: null
			}

			let facilitySurveyData = await FacilitySurvey.findOne({
				where: {
					id: facilitySurveyId,
					status: 1
				},
				include: [{
					model: Lsgi
				}, {
					model: CategoryRelationship,

				}, {
					model: Ward
				}, {
					model: FacilityType
				},
				{
					model: User
				}, {
					model: FacilitySurveyQuestionOption,
					as: 'technologys',
					attributes: ['id', 'option_name_en']

				},
				{
					model: FacilitySurveyQuestionOption,
					as: 'operational',
					attributes: ['id', 'option_name_en']

				}
				]

			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting facility data',
						error: err
					})
				})
			console.log('line 7812');


			let parent_cat_id;
			let child_cat_id;
			if (facilitySurveyData) {
				if (facilitySurveyData.categoryRelatioship) {
					if (facilitySurveyData.categoryRelatioship.parent_cat_id) {
						parent_cat_id = facilitySurveyData.categoryRelatioship.parent_cat_id;
					}
					if (facilitySurveyData.categoryRelatioship.child_cat_id) {
						child_cat_id = facilitySurveyData.categoryRelatioship.child_cat_id;
					}
				}
			}
			console.log('line 7827');


			if (parent_cat_id) {
				let parent_category = await Category.findOne({
					where: {
						id: parent_cat_id,
						status: 1
					}
				}).catch(err => {
					return {
						success: 0,
						message: 'Something went wrong while getting parent category data',
						error: err
					}
				});
				console.log('line 7843');

				if (parent_category.err) {
					return res.send(err);
				}
				console.log('line 7848');

				categoryData.parent_category = parent_category;
				// console.log(JSON.stringify(parent_category))
			}
			console.log('line 7853');

			if (child_cat_id) {
				let child_category = await Category.findOne({
					where: {
						id: child_cat_id,
						status: 1
					}
				}).catch(err => {
					return {
						success: 0,
						message: 'Something went wrong while getting child category data',
						error: err
					}
				});
				console.log('line 7868');

				if (child_category.err) {
					return res.send(err);
				}
				console.log('line 7873');

				categoryData.child_category = child_category;

			}
			console.log('line 7878');

			let images = await FacilitySurveyImage.findAll({
				where: {
					facility_survey_id: facilitySurveyId,
					status: 1
				},
				include: [{
					model: Image,
					attributes: ['name']
				}],
				attributes: []
			})
				.catch(err => {
					return {
						success: 0,
						message: 'Something went wrong while getting images data',
						error: err
					}
				})
			console.log('line 7898');

			if (images && images.err) {
				return res.send(images);
			}
			console.log('line 7903');

			let img = [];
			for (let i = 0; i < images.length; i++) {
				let img_name = images[i].image.name
				img.push(img_name);
			}
			console.log('line 7910');

			//	images=images? images : [];

			let response = {
				image_base: profileConfig.imageBase,
				facility_survey_data: facilitySurveyData,
				category: categoryData,
				images: img,
				success: 1
			}

			return res.send(response);
		},
		this.deleteFacilitySurvey = async (req, res) => {
			let facilitySurveyId = req.params.id;
			let facilitySurveyData = await FacilitySurvey.findOne({
				where: {
					id: facilitySurveyId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting facility survey data',
						error: err
					})
				})
			if (facilitySurveyData) {
				let update = {
					status: 0
				}
				await FacilitySurvey.update(update, {
					where: {
						id: facilitySurveyId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while deleting facility survey',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Facility survey deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "Facility survey not exists."
				});
			}


		},

		this.createImage = async (req, res) => {
			let params = req.body;

			if (!params.name) {
				var errors = [];

				if (!params.name) {
					errors.push({
						field: "name",
						message: 'Require name'

					});
				}

				return res.send({
					success: 0,
					statusCode: 400,
					errors: errors,
				});
			};


			let imageObj = {
				name: params.name,
				status: 1
			}
			let nameCheck = await Image.findOne({
				where: {
					name: params.name,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking image exists or not',
						error: err
					})
				})
			if (nameCheck) {
				return res.send({
					success: 0,
					message: 'Image name already exists..'
				})
			}


			try {
				let data = await Image.create(imageObj);

				res.status(200).send({
					success: 1,
					id: data.dataValues.id,
					message: "Image created successfully."
				});
			} catch (err) {
				console.log(err);
				return res.send({
					success: 0,
					message: 'Error while create a Image'
				})
			}
		},
		this.updateImage = async (req, res) => {
			let imageId = req.params.id;
			let update = {};
			update.modified_at = new Date();
			update.status = 1;
			if (!req.body.name) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}
			if (req.body.name) {
				update.name = req.body.name.trim();
			}

			let idData = await Image.findOne({
				where: {
					id: imageId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking image id exists or not',
						error: err
					})
				})
			if (!idData) {
				return res.send({
					success: 0,
					message: 'Invalid image'
				})
			} else {
				if (req.body.name) {
					let imageData = await Image.findOne({
						where: {
							name: req.body.name,
							status: 1,
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking name already exists or not',
								error: err
							})
						})
					if (imageData && (imageData.id !== imageId)) {
						return res.send({
							success: 0,
							message: 'Image already exists '
						})
					}
				}

				await Image.update(update, {
					where: {
						id: imageId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating name',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Image name updated successfully."
				});
			}


		},
		this.listImage = async (req, res) => {
			let params = req.query;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			whereCondition.status = 1;
			if (params.name) {
				whereCondition.name_en = {
					[Op.like]: '%' + params.name + '%'
				};
				// whereCondition.name_ml = {
				//   [Op.like]: '%' + params.name + '%'
				// };
			}

			var images = await Image.findAll({
				// raw: true,
				order: [
					['modified_at', 'DESC']
				],
				offset: offset,
				where: whereCondition,
				// where: {
				//   status: 1
				// },
				limit: perPage,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching images data',
						error: err
					})
				});

			var count = await Image.count({
				where: whereCondition,

			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching image count data',
						error: err
					})
				});

			totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				image_base: profileConfig.imageBase,
				items: images,
				total_items: count,
				has_next_page: hasNextPage,
				total_pages: totalPages,
				page,
				per_page: perPage,
				message: "Images listed successfully",
				success: 1,
			}
			return res.send(response);
		},


		this.getImage = async (req, res) => {
			let imageId = req.params.id;
			let imageData = await Image.findOne({
				where: {
					id: imageId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting image data',
						error: err
					})
				})
			let response = {
				imageBase: profileConfig.imageBase,
				image: imageData,
				success: 1,
			}
			return res.send(response);
		},
		this.deleteImage = async (req, res) => {
			let imageId = req.params.id;
			let imageData = await Image.findOne({
				where: {
					id: imageId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting image data',
						error: err
					})
				})
			if (imageData) {
				let update = {
					status: 0
				}
				await Image.update(update, {
					where: {
						id: imageData.id

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while deleting name',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Image deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "Image not exists."
				});
			}


		},




		this.createFacilitySurveyImage = async (req, res) => {
			let params = req.body;

			if (!params.facility_survey_id || !params.image_id) {
				var errors = [];

				if (!params.facility_survey_id) {
					errors.push({
						field: "name_ml",
						message: 'Require facility survey id'

					});
				}
				if (!params.image_id) {
					errors.push({
						field: "name_en",
						message: 'Require image id'
					});
				}

				return res.send({
					success: 0,
					statusCode: 400,
					errors: errors,
				});
			};

			let facilitySurveyData = await FacilitySurvey.findOne({
				where: {
					id: params.facility_survey_id,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting facility survey data',
						error: err
					})
				})
			if (!facilitySurveyData) {
				return res.send({
					success: 0,
					message: 'Facility survey id invalid',
				})
			}
			let facilitySurveyImageObj = req.body;
			facilitySurveyImageObj.status = 1


			try {
				let data = await FacilitySurveyImage.create(facilitySurveyImageObj);

				res.status(200).send({
					success: 1,
					id: data.dataValues.id,
					message: "Facility survey image created successfully."
				});
			} catch (err) {
				console.log(err);
				return res.send({
					success: 0,
					message: 'Error while create a Facility survey image'
				})
			}
		},
		this.updateDistrict = async (req, res) => {
			let districtId = req.params.id;
			let update = {};
			update.modified_at = new Date();
			update.status = 1;
			if (!req.body.name_ml && !req.body.name_en) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}
			if (req.body.name_ml) {
				update.name_ml = req.body.name_ml.trim();
			}
			if (req.body.name_en) {
				update.name_en = req.body.name_en.trim();
			}
			let idData = await District.findOne({
				where: {
					id: districtId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking district id exists or not',
						error: err
					})
				})
			if (!idData) {
				return res.send({
					success: 0,
					message: 'Invalid district '
				})
			} else {
				if (req.body.name_en) {
					let districtData = await District.findOne({
						where: {
							name_en: req.body.name_en,
							status: 1,
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking English district name already exists or not',
								error: err
							})
						})
					if (districtData && (districtData.id !== districtId)) {
						return res.send({
							success: 0,
							message: 'District English name already exists '
						})
					}
				}

				if (req.body.name_ml) {
					let districtData = await District.findOne({
						where: {
							name_ml: req.body.name_ml,
							status: 1,
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking malayalam district name already exists or not',
								error: err
							})
						})
					if (districtData && (districtData.id !== districtId)) {
						return res.send({
							success: 0,
							message: 'District Malayalam name already exists '
						})
					}
				}

				await District.update(update, {
					where: {
						id: districtId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating district name',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "District name updated successfully."
				});
			}


		},
		this.listFacilitySurveyImage = async (req, res) => {
			let params = req.query;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			whereCondition.status = 1;
			if (params.facility_survey_id) {
				whereCondition.facility_survey_id = params.facility_survey_id;
				// whereCondition.name_ml = {
				//   [Op.like]: '%' + params.name + '%'
				// };
			} else {
				return res.send({
					success: 0,
					message: 'Required Facility survey id ',
				})
			}

			var facilitySurveyImageData = await FacilitySurveyImage.findAll({
				// raw: true,
				order: [
					['modified_at', 'DESC']
				],
				offset: offset,
				where: whereCondition,
				include: [{
					model: Image
				}],
				// where: {
				//   status: 1
				// },
				limit: perPage,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching facility survey images',
						error: err
					})
				});

			var count = await FacilitySurveyImage.count({
				where: whereCondition,

			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching facility survey image count data',
						error: err
					})
				});

			totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: facilitySurveyImageData,
				total_items: count,
				has_next_page: hasNextPage,
				total_pages: totalPages,
				page,
				per_page: perPage,
				message: "FacilitySurveyImage listed successfully",
				success: 1,
			}
			return res.send(response);
		},


		this.getFacilitySurveyImage = async (req, res) => {
			let facilitySurveyImageId = req.params.id;
			let facilitySurveyImageData = await FacilitySurveyImage.findOne({
				where: {
					id: facilitySurveyImageId,
					status: 1
				},
				include: [{
					model: Image
				}]
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting facility survey iamge data',
						error: err
					})
				})
			let response = {
				facility_survey_image: facilitySurveyImageData,
				success: 1,
			}
			return res.send(response);
		},
		this.deleteFacilitySurveyImage = async (req, res) => {
			let facilitySurveyImageId = req.params.id;
			let facilitySurveyImageData = await FacilitySurveyImage.findOne({
				where: {
					id: facilitySurveyImageId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting facility survey image data',
						error: err
					})
				})
			if (facilitySurveyImageData) {
				let update = {
					status: 0
				}
				await FacilitySurveyImage.update(update, {
					where: {
						id: facilitySurveyImageId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while deleting facility survey image',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Facility survey image deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "Facility survey image not exists."
				});
			}


		},





		this.createMainSurveyMasterQuestion = async (req, res) => {
			let params = req.body;

			if (!params.question_en || !params.question_ml
				|| !params.type) {
				var errors = [];

				if (!params.question_en) {
					errors.push({
						field: "question_en",
						message: 'Require question in English'

					});
				}
				if (!params.question_ml) {
					errors.push({
						field: "question_ml",
						message: 'Require question Malayalam'

					});
				}
				// if (!params.field_name) {
				// 	errors.push({
				// 		field: "field_name",
				// 		message: 'Require field name'
				// 	});
				// }
				if (!params.type) {
					errors.push({
						field: "type",
						message: 'Require type'
					});
				}
				if (!params.sort_order) {
					errors.push({
						field: "type",
						message: 'Require type'
					});
				}

				return res.send({
					success: 0,
					statusCode: 400,
					errors: errors,
				});
			};
			
			let mainSurveyMasterQuestionObj = {
				question_en: params.question_en.trim(),
				question_ml: params.question_ml.trim(),
				field_name: params.field_name.trim(),
				type: params.type.trim(),
				sort_order: params.sort_order,
				status: 1
			}

			if (params.is_decimal === undefined) {
				mainSurveyMasterQuestionObj.is_decimal = 0
			} else {
				mainSurveyMasterQuestionObj.is_decimal = params.is_decimal;
			}
			
			let mainSurveyMasterQuestionCheck = await MainSurveyMasterQuestion.findOne({
				where: {
					question_en: params.question_en.trim(),
					question_ml: params.question_ml.trim(),
					field_name: params.field_name.trim(),
					type: params.type.trim(),
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking question exists or not',
						error: err
					})
				})
			if (mainSurveyMasterQuestionCheck) {
				return res.send({
					success: 0,
					message: 'Question already exists..'
				})
			}

			// let nameEnCheck = await District.findOne({
			// 		where: {
			// 			name_en: params.name_en,
			// 			status: 1
			// 		}
			// 	})
			// 	.catch(err => {
			// 		return res.send({
			// 			success: 0,
			// 			message: 'Something went wrong while checking english district name exists or not',
			// 			error: err
			// 		})
			// 	})
			// if (nameEnCheck) {
			// 	return res.send({
			// 		success: 0,
			// 		message: 'District english name already exists..'
			// 	})
			// }
			try {
				let data = await MainSurveyMasterQuestion.create(mainSurveyMasterQuestionObj);

				res.status(200).send({
					success: 1,
					id: data.dataValues.id,
					message: "MainSurveyMasterQuestion created successfully."
				});
			} catch (err) {
				console.log(err);
				return res.send({
					success: 0,
					message: 'Error while create a MainSurveyMasterQuestion'
				})
			}
		},
		this.updateMainSurveyMasterQuestion = async (req, res) => {
			let mainSurveyMasterQuestionId = req.params.id;
			let update = {};
			update.modified_at = new Date();
			update.status = 1;
			if (!req.body.question_en && !req.body.question_ml
				&& !req.body.field_name && !req.body.type
				&& !req.body.sort_order) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}
			if (req.body.question_en) {
				update.question_en = req.body.question_en.trim();
			}
			if (req.body.question_ml) {
				update.question_ml = req.body.question_ml.trim();
			}
			if (req.body.field_name) {
				update.field_name = req.body.field_name.trim();
			}
			if (req.body.type) {
				update.type = req.body.type.trim();
			}
			if (req.body.sort_order) {
				update.sort_order = req.body.sort_order;
			}
			if(req.body.is_decimal){
				update.is_decimal=req.body.is_decimal;
			}else{
				update.is_decimal=0;
			}
			let idData = await MainSurveyMasterQuestion.findOne({
				where: {
					id: mainSurveyMasterQuestionId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking mainSurveyMasterQuestionId exists or not',
						error: err
					})
				})

			if (!idData) {
				return res.send({
					success: 0,
					message: 'Invalid mainSurveyMasterQuestionId '
				})
			} else {

				if (req.body.question_en) {
					let mainSurveyMasterQuestionData = await MainSurveyMasterQuestion.findOne({
						where: {
							question_en: req.body.question_en.trim(),
							// field_name : idData.dataValues.field_name,
							// type : idData.dataValues.type,
							status: 1,
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking question in English already exists or not',
								error: err
							})
						})
					if (mainSurveyMasterQuestionData && (mainSurveyMasterQuestionData.question_en !== idData.question_en)) {
						return res.send({
							success: 0,
							message: 'Question in English already exists '
						})
					}
				}

				if (req.body.question_ml) {
					let mainSurveyMasterQuestionData = await MainSurveyMasterQuestion.findOne({
						where: {
							question_ml: req.body.question_ml.trim(),
							// field_name : idData.dataValues.field_name,
							// type : idData.dataValues.type,
							status: 1,
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking question in malayalam already exists or not',
								error: err
							})
						})
					if (mainSurveyMasterQuestionData && (mainSurveyMasterQuestionData.question_ml !== idData.question_ml)) {
						return res.send({
							success: 0,
							message: 'Question in Malayalam already exists '
						})
					}
				}

				if (req.body.field_name) {
					let mainSurveyMasterQuestionData = await MainSurveyMasterQuestion.findOne({
						where: {
							field_name: req.body.field_name.trim(),
							// field_name : idData.dataValues.field_name,
							// type : idData.dataValues.type,
							status: 1,
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking field name already exists or not',
								error: err
							})
						})
					if (mainSurveyMasterQuestionData && (mainSurveyMasterQuestionData.field_name !== idData.field_name)) {
						return res.send({
							success: 0,
							message: 'Field name is already exists '
						})
					}
				}

				// if (req.body.name_ml) {
				// 	let districtData = await District.findOne({
				// 			where: {
				// 				name_ml: req.body.name_ml,
				// 				status: 1,
				// 			}
				// 		})
				// 		.catch(err => {
				// 			return res.send({
				// 				success: 0,
				// 				message: 'Something went wrong while checking malayalam district name already exists or not',
				// 				error: err
				// 			})
				// 		})
				// 	if (districtData && (districtData.id !== districtId)) {
				// 		return res.send({
				// 			success: 0,
				// 			message: 'District Malayalam name already exists '
				// 		})
				// 	}
				// }

				await MainSurveyMasterQuestion.update(update, {
					where: {
						id: mainSurveyMasterQuestionId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating MainSurveyMasterQuestion',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "MainSurveyMasterQuestion updated successfully."
				});
			}


		},
		this.listMainSurveyMasterQuestion = async (req, res) => {
			let params = req.query;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			whereCondition.status = 1;
			if (params.name) {
				whereCondition.name_en = {
					[Op.like]: '%' + params.name + '%'
				};
				// whereCondition.name_ml = {
				//   [Op.like]: '%' + params.name + '%'
				// };
			}

			var mainSurveyMasterQuestionData = await MainSurveyMasterQuestion.findAll({
				// raw: true,
				order: [
					['modified_at', 'DESC']
				],
				offset: offset,
				where: whereCondition,
				// where: {
				//   status: 1
				// },
				limit: perPage,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching mainSurveyMasterQuestion data',
						error: err
					})
				});

			var count = await MainSurveyMasterQuestion.count({
				where: whereCondition,

			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching MainSurveyMasterQuestion count',
						error: err
					})
				});

			totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: mainSurveyMasterQuestionData,
				total_items: count,
				total_pages: totalPages,
				page,
				per_page: perPage,
				has_next_page: hasNextPage,
				message: "Main Survey Master Question Data listed successfully",
				success: 1,
			}
			return res.send(response);
		},


		this.getMainSurveyMasterQuestion = async (req, res) => {
			let mainSurveyMasterQuestionId = req.params.id;
			let mainSurveyMasterQuestionObj = await MainSurveyMasterQuestion.findOne({
				where: {
					id: mainSurveyMasterQuestionId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting mainSurveyMasterQuestion data',
						error: err
					})
				})
			let response = {
				mainSurveyMasterQuestion: mainSurveyMasterQuestionObj,
				success: 1,
			}
			return res.send(response);
		},
		this.deleteMainSurveyMasterQuestion = async (req, res) => {
			let mainSurveyMasterQuestionId = req.params.id;
			let mainSurveyMasterQuestionObj = await MainSurveyMasterQuestion.findOne({
				where: {
					id: mainSurveyMasterQuestionId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting facilitySurveyQuestion data',
						error: err
					})
				})
			if (mainSurveyMasterQuestionObj) {
				let update = {
					status: 0
				}
				await MainSurveyMasterQuestion.update(update, {
					where: {
						id: mainSurveyMasterQuestionId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while deleting MainSurveyMasterQuestion',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "MainSurveyMasterQuestion deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "MainSurveyMasterQuestion not exists."
				});
			}


		},


		this.listMainSurveyFieldName = async (req, res) => {
			// let params = req.query;
			// let page = params.page || 1;
			// let perPage = Number(params.per_page) || 10;
			// perPage = perPage > 0 ? perPage : 10;
			// var offset = (page - 1) * perPage;
			let whereCondition = {};
			whereCondition.status = 1;
			whereCondition.type = constants.MAIN_SURVEY_TYPE;
			// if (params.name) {
			// 	whereCondition.name_en = {
			// 		[Op.like]: '%' + params.name + '%'
			// 	};
			// 	// whereCondition.name_ml = {
			// 	//   [Op.like]: '%' + params.name + '%'
			// 	// };
			// }

			var fieldNameData = await FieldName.findAll({
				// raw: true,
				// order: [
				// 	['modified_at', 'DESC']
				// ],
				// offset: offset,
				where: whereCondition,
				// where: {
				//   status: 1
				// },
				// limit: perPage,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching fieldname data',
						error: err
					})
				});

			// var count = await MainSurveyMasterQuestion.count({
			// 		where: whereCondition,

			// 	})
			// 	.catch(err => {
			// 		return res.send({
			// 			success: 0,
			// 			message: 'Something went wrong while fetching MainSurveyMasterQuestion count',
			// 			error: err
			// 		})
			// 	});

			// totalPages = count / perPage;
			// totalPages = Math.ceil(totalPages);
			// var hasNextPage = page < totalPages;
			// let fieldNames = [];
			// for (let i = 0; i < mainSurveyMasterQuestionData.length; i++) {
			// 	fieldNames.push(mainSurveyMasterQuestionData[i].field_name);
			// }
			let response = {
				items: fieldNameData,
				// totalItems: count,
				// hasNextPage,
				message: "Main Survey Master Question Data listed successfully",
				success: 1,
			}
			return res.send(response);
		},


		this.listFacilitySurveyFieldName = async (req, res) => {
			// let params = req.query;
			// let page = params.page || 1;
			// let perPage = Number(params.per_page) || 10;
			// perPage = perPage > 0 ? perPage : 10;
			// var offset = (page - 1) * perPage;
			let whereCondition = {};
			whereCondition.status = 1;
			whereCondition.type = constants.FACILITY_SURVEY_TYPE;
			// if (params.name) {
			// 	whereCondition.name_en = {
			// 		[Op.like]: '%' + params.name + '%'
			// 	};
			// 	// whereCondition.name_ml = {
			// 	//   [Op.like]: '%' + params.name + '%'
			// 	// };
			// }

			var fieldNameData = await FieldName.findAll({
				// raw: true,
				// order: [
				// 	['modified_at', 'DESC']
				// ],
				// offset: offset,
				where: whereCondition,
				// where: {
				//   status: 1
				// },
				// limit: perPage,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching field name data',
						error: err
					})
				});

			// var count = await MainSurveyMasterQuestion.count({
			// 		where: whereCondition,

			// 	})
			// 	.catch(err => {
			// 		return res.send({
			// 			success: 0,
			// 			message: 'Something went wrong while fetching MainSurveyMasterQuestion count',
			// 			error: err
			// 		})
			// 	});

			// totalPages = count / perPage;
			// totalPages = Math.ceil(totalPages);
			// var hasNextPage = page < totalPages;

			let response = {
				items: fieldNameData,
				// totalItems: count,
				// hasNextPage,
				message: "Field name listed successfully",
				success: 1,
			}
			return res.send(response);
		},

		this.updateVersion = async (req, res) => {
			let newVersion = 1;
			var versionData = await Version.findOne({
				limit: 1,
				where: {
					status: 1,
				},
				raw: true,
				order: [
					['created_at', 'DESC']
				]
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching version data',
						error: err
					})
				});

			if (versionData) {
				let version = versionData.version;
				newVersion = version + 1;
			}
			let newVersionData = {
				version: newVersion,
				status: 1
			}
			versionData = await Version.create(newVersionData)
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while updating version',
						error: err
					})
				});

			let response = {
				id: versionData.dataValues.id,
				// totalItems: count,
				// hasNextPage,
				message: "Version updated successfully",
				success: 1,
			}
			return res.send(response);
		},


		this.getVersion = async (req, res) => {
			var versionData = await Version.findOne({
				limit: 1,
				where: {
					status: 1,
				},
				raw: true,
				order: [
					['created_at', 'DESC']
				]
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching version data',
						error: err
					})
				});
			let response = {
				version: versionData.version,
				// totalItems: count,
				// hasNextPage,
				message: "Success",
				success: 1,
			}
			return res.send(response);
		},






		this.createAuthController = async (req, res) => {
			let params = req.body;

			if (!params.name) {
				var errors = [];

				if (!params.name) {
					errors.push({
						field: "name",
						message: 'Require name'

					});
				}

				return res.send({
					success: 0,
					statusCode: 400,
					errors: errors,
				});
			};


			let authControllerObj = {
				name: params.name.trim(),
				status: 1
			}
			let nameCheck = await AuthController.findOne({
				where: {
					name: params.name.trim(),
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking auth controller name exists or not',
						error: err
					})
				})
			if (nameCheck) {
				return res.send({
					success: 0,
					message: 'AuthController name already exists..'
				})
			}


			try {
				let data = await AuthController.create(authControllerObj);

				res.status(200).send({
					success: 1,
					id: data.dataValues.id,
					message: "AuthController created successfully."
				});
			} catch (err) {
				console.log(err);
				return res.send({
					success: 0,
					message: 'Error while create a AuthController'
				})
			}
		},
		this.updateAuthController = async (req, res) => {
			let authControllerId = req.params.id;
			let update = {};
			update.modified_at = new Date();
			update.status = 1;
			if (!req.body.name) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}
			if (req.body.name) {
				update.name = req.body.name.trim();
			}

			let idData = await AuthController.findOne({
				where: {
					id: authControllerId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking authcontroller id exists or not',
						error: err
					})
				})
			if (!idData) {
				return res.send({
					success: 0,
					message: 'Invalid Authcontroller Id'
				})
			} else {
				if (req.body.name) {
					let authControllerData = await AuthController.findOne({
						where: {
							name: req.body.name.trim(),
							status: 1,
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking Authcontroller name already exists or not',
								error: err
							})
						})
					if (authControllerData && (authControllerData.id !== authControllerId)) {
						return res.send({
							success: 0,
							message: 'AuthControllerData name already exists '
						})
					}
				}



				await AuthController.update(update, {
					where: {
						id: authControllerId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating authcontroller name',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Authcontroller name updated successfully."
				});
			}


		},
		this.listAuthController = async (req, res) => {
			let params = req.query;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			if (params.name) {
				whereCondition.name = {
					[Op.like]: '%' + params.name + '%',
				};

			}
			whereCondition.status = 1;

			var authControllers = await AuthController.findAll({
				order: [
					['modified_at', 'DESC']
				],
				offset: offset,
				where: whereCondition,

				limit: perPage,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching authController data',
						error: err
					})
				});

			var count = await AuthController.count({
				where: whereCondition,

			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching auth controller count data',
						error: err
					})
				});

			totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: authControllers,
				total_items: count,
				has_next_page: hasNextPage,
				total_pages: totalPages,
				page,
				per_page: perPage,
				message: "AuthController listed successfully",
				success: 1,
			}
			return res.send(response);
		},
		this.getControllerAuthPermission = async (req, res) => {
			let authControllerId = req.params.id;
			let authControllerData = await AuthController.findOne({
				where: {
					id: authControllerId,
					status: 1
				},
				include: [{
					model: AuthPermission
				}]
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting authcontroller data',
						error: err
					})
				})
			let response = {
				authController: authControllerData,
				success: 1,
			}
			return res.send(response);
		},

		this.getAuthController = async (req, res) => {
			let authControllerId = req.params.id;
			let authControllerData = await AuthController.findOne({
				where: {
					id: authControllerId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting authcontroller data',
						error: err
					})
				})
			let response = {
				authController: authControllerData,
				success: 1,
			}
			return res.send(response);
		},
		this.deleteAuthController = async (req, res) => {
			let authControllerId = req.params.id;
			let authControllerData = await AuthController.findOne({
				where: {
					id: authControllerId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting authcontroller data',
						error: err
					})
				})
			if (authControllerData) {
				let update = {
					status: 0
				}
				await AuthController.update(update, {
					where: {
						id: authControllerId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while deleting authcotroller',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Authcontroller deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "Authcontroller not exists."
				});
			}


		},
		this.tokenvalidator = async (req, res) => {
			let token = req.params.token;

			jwt.verify(token, JWT_KEY, (err, authData) => {
				if (err) {
					//console.log("Invalid JWT token");
					return res.send({ success: 0, is_valid: false })
				} else {
					return res.send({ success: 1, is_valid: true })

				}
			});
		},

		this.listMainSurvey = async (req, res) => {
			let params = req.query;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			if (params.name) {
				let name_en = {
					[Op.like]: '%' + params.name + '%',
				};
				let name_ml = {
					[Op.like]: '%' + params.name + '%'
				};
				whereCondition = Sequelize.or({ name_en }, { name_ml })
			}
			if (params.district_id) {
				whereCondition.district_id = params.district_id
			}
			if (params.lsgi_type_id) {
				whereCondition.lsgi_type_id = params.lsgi_type_id
			}
			if (params.lsgi_id) {
				whereCondition.lsgi_id = params.lsgi_id
			}
			if (params.grade) {
				whereCondition.grade = params.grade
			}
			if (params.lsgi_block_id) {
				whereCondition.lsgi_block_id = params.lsgi_block_id
			}
			whereCondition.status = 1;
			whereCondition.is_active = 1;

			let userDataz = req.identity.data;
			if (userDataz.district_id && userDataz.district_id != null) {
				whereCondition.district_id = userDataz.district_id;
			}
			if (userDataz.lsgi_id && userDataz.lsgi_id != null) {
				whereCondition.lsgi_id = userDataz.lsgi_id;
			}
			if (userDataz.lsgi_block_id && userDataz.lsgi_block_id != null) {
				whereCondition.lsgi_block_id = userDataz.lsgi_block_id;
			}

			if (params.start_date || params.end_date) {
				if (params.start_date && !params.end_date) {

					let startdate = params.start_date;
					console.log(startdate);

					chkNullDate(startdate, res);



					whereCondition.created_at = {
						[Op.gte]: startdate,
						[Op.lte]: new Date()
					}
				}
				if (!params.start_date && params.end_date) {
					let enddate = params.end_date;
					console.log(enddate);


					chkNullDate(enddate, res);


					whereCondition.created_at = {
						[Op.lte]: enddate
					}

				}
				if (params.start_date && params.end_date) {
					let startdate = params.start_date;
					let enddate = params.end_date;
					console.log(startdate);
					console.log(enddate);
					chkNullDate(startdate, res);

					chkNullDate(enddate, res);


					whereCondition.created_at = {
						[Op.between]: [startdate, enddate]
					}
				}
			}
			var surveyData = await Survey.findAll({
				order: [
					['modified_at', 'DESC']
				],
				offset: offset,
				where: whereCondition,
				include: ['lsgi', 'lsgiBlock', 'lsgiType', 'officeType',
					{
						model: User,
						attributes: ['id', 'name', 'middle_name', 'last_name', 'designation', 'gender'],
						where: {
							status: 1
						}
					}
					, 'district'],

				limit: perPage,
			})


			var count = await Survey.count({
				where: whereCondition,

			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching survey count data',
						error: err
					})
				});

			totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: surveyData,
				total_items: count,
				has_next_page: hasNextPage,
				total_pages: totalPages,
				page,
				per_page: perPage,
				message: "Surveys listed successfully",
				success: 1,
			}
			return res.send(response);
		},
		this.getMainSurvey = async (req, res) => {
			let surveyId = req.params.id;

			let surveyData = await Survey.findOne({
				where: {
					id: surveyId,
					status: 1,
					is_active: 1
				},
				include: ['lsgi', 'lsgiBlock', 'lsgiType', 'officeType', {
					model: User,
					attributes: ['id', 'name', 'middle_name', 'last_name', 'designation', 'gender'],
					where: {
						status: 1
					}
				}, 'district'
					// ,{
					// 	model: SurveyAnswer,

					// 	include: [{
					// 		model: Question,
					// 		order: [
					// 			['sort_order', 'ASC']
					// 		]
					// 	},{
					// 		model: QuestionOption
					// 	}]
					// }
				]
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting survey data',
						error: err
					})
				})

			let surveyAnswers = await SurveyAnswer.findAll({
				where: {
					survey_id: surveyId,
					status: 1
				},
				// raw:true,
				// order:[
				// 	['question_id','ASC']
				// ],

				include: [
					{
						model: Question,

						required: true

					}, {
						model: QuestionOption,
						required: false
					}
				],

				order: [
					[{ model: Question }, 'sort_order', 'ASC']
				]


			}).catch(err => {
				return res.send({
					success: 0,
					message: 'Something went wrong while getting survey data',
					error: err
				})
			})
			let data = {
				survey: surveyData,
				surveyAnswers: surveyAnswers
			}

			let response = {
				survey: data,
				success: 1,
			}

			return res.send(response);
		},
		this.deleteMainSurvey = async (req, res) => {
			let surveyId = req.params.id;
			let surveyData = await Survey.findOne({
				where: {
					id: surveyId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting survey data',
						error: err
					})
				})
			if (surveyData) {
				let update = {
					status: 0
				}
				await Survey.update(update, {
					where: {
						id: surveyData.id

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while deleting survey',
							error: err
						})
					})
				await SurveyAnswer.update(update, {
					where: {
						survey_id: surveyData.id

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while deleting survey',
							error: err
						})
					})

				res.status(200).send({
					success: 1,
					message: "Survey deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "Survey not exists."
				});
			}


		},

		this.updateMainSurvey = async (req, res) => {
			const Op = require('sequelize').Op;
			var errors = [];
			let surveyArray = [];
			let item = req.body;
			let userData = req.identity;
			let surveyorAccountId = userData.data.id;
			let reqParam = req.params;
			let surveyObj = {};
			let officePlaceName = "";
			let officePostOfficeName = "";
			let officePinCode = "";
			console.log("item")
			console.log(item)
			console.log("item")
			surveyObj.id = reqParam.id;

			surveyObj.district_id = item.district_id;
			surveyObj.lsgi_type_id = item.lsgi_type_id;
			surveyObj.lat = item.lat;
			surveyObj.lng = item.lng;
			if (item.lsgi_block_id) {
				surveyObj.lsgi_block_id = item.lsgi_block_id;
			}
			surveyObj.lsgi_id = item.lsgi_id;
			surveyObj.office_name = item.office_name;
			surveyObj.office_type_id = item.office_type_id;

			surveyObj.phone = item.phone;
			surveyObj.email = item.email;
			surveyObj.lead_person_name = item.lead_person_name;
			surveyObj.lead_person_designation = item.lead_person_designation;
			surveyObj.informer_name = item.informer_name;
			surveyObj.informer_designation = item.informer_designation;
			surveyObj.informer_phone = item.informer_phone;
			officePlaceName = item.office_place_name;
			officePostOfficeName = item.office_post_office_name;
			officePinCode = item.office_pin_ode;
			// surveyObj.address = officePlaceName + "," + officePostOfficeName + "," + officePinCode;
			surveyObj.answers = item.answers
			surveyObj.survey_date = item.survey_date;
			surveyObj.surveyor_account_id = surveyorAccountId
			surveyObj.status = 1
			//   surveyArray.push(surveyObj);
			let whereCondition = {
				id: surveyObj.id,
				status: 1
			}
			// try{
			let surveyData = await Survey.findAll({
				where: whereCondition
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching survey data',
						error: err
					})
				});
			// if (surveyData.length > 0) {


			let points = 0;
			let surveyId = surveyObj.id;
			let answersArray = surveyObj.answers;
			surveyObj.id = surveyId;
			await Promise.all(answersArray.map(async (item1) => {
				let obj = {};
				let mark = [];
				obj.survey_id = surveyId;
				obj.question_id = item1.id;

				if (item1.answer) {
					obj.answer = item1.answer;
				}

				if (item1.type.toString() === constants.ANSWER_TYPE_OPTION) {

					let optionObj = await item1.options.find(o => o.is_selected === constants.IS_SELECTED_TRUE);
					obj.question_option_id = optionObj.id;
					obj.answer = optionObj.value;

					mark = await QuestionOption.findAll({
						raw: true,
						limit: 1,
						attributes: ['id', 'question_id', 'point'],

						where: {
							question_id: obj.question_id,
							id: obj.question_option_id,
							name: obj.answer,
							status: 1
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while fetching questions data',
								error: err
							})
						})
					if (mark.length > 0) {
						obj.point = parseInt(mark[0].points);
						points = points + mark[0].points;
					}
				} else if (item1.type.toString() === constants.ANSWER_TYPE_ADDRESS) {
					obj.point = 0;
					obj.question_option_id = null;
				} else if (item1.type.toString() === constants.ANSWER_TYPE_DIGIT) {

					let percentageQuestion = await Question.findAll({
						raw: true,
						where: {
							id: obj.question_id,
							is_dependent: 1,
							is_percentage_calculation: 1,
							status: 1,
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while fetching Question data',
								error: err
							})
						});
					if (percentageQuestion.length > 0) {

						let dependedObj = await answersArray.find(o => o.id === percentageQuestion[0].dependent_question_id);

						let totalCount = dependedObj.answer;
						let count = item1.answer;
						let percentage = (count / totalCount) * 100;

						let gradeObj = await percentageConfiguarationSlab.findAll({
							where: {
								start_value: {
									[Op.lte]: percentage
								},
								end_value: {
									[Op.gte]: percentage
								},
							}
						})
							.catch(err => {
								return res.send({
									success: 0,
									message: 'Something went wrong while fetching PercentageConfiguaration data',
									error: err
								})
							});

						obj.point = parseInt(gradeObj[0].point);
						points = points + obj.point;

					} else {
						obj.point = 0;
					}

				} else if (item1.type.toString() === constants.ANSWER_TYPE_TEXT) {
					obj.point = 0;
					obj.question_option_id = null;

				}
				obj.status = 1;

				let answer = await SurveyAnswer.findAll({
					raw: true,
					where: {
						survey_id: surveyObj.id,
						question_id: item1.id
					}

				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while fetching SurveyAnswer data',
							error: err
						})
					});

				let answerUpdate = await SurveyAnswer.update(obj, {
					where: {
						id: answer[0].id
					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating SurveyAnswer data',
							error: err
						})
					});
			}));

			surveyObj.points = points;

			let surveyUpdate = await Survey.update(surveyObj, {
				where: {
					id: surveyId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while updating survey data',
						error: err
					})
				});


			res.status(200).send({
				success: 1,
				message: "Survey Updated successfully",
			});


		},


		this.createAuthPermission = async (req, res) => {
			let params = req.body;

			if (!params.permission || !params.auth_controller_id) {
				var errors = [];

				if (!params.permission) {
					errors.push({
						field: "permission",
						message: 'Require permission name'

					});
				}
				if (!params.auth_controller_id) {
					errors.push({
						field: "auth_controller_id",
						message: 'Require auth controller id'
					});
				}

				return res.send({
					success: 0,
					statusCode: 400,
					errors: errors,
				});
			};


			let authPermissionObj = {
				permission: params.permission.trim(),
				auth_controller_id: params.auth_controller_id,
				status: 1
			}
			let authControllerCheck = await AuthController.findOne({
				where: {
					id: params.auth_controller_id,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking auth cotroller id exists or not',
						error: err
					})
				})

			if (!authControllerCheck) {
				return res.send({
					success: 0,
					message: 'Invalid auth controller id..'
				})
			}

			let permissionCheck = await AuthPermission.findOne({
				where: {
					auth_controller_id: params.auth_controller_id,
					permission: params.permission,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking malayalam permission name already exists or not',
						error: err
					})
				})
			if (permissionCheck) {
				return res.send({
					success: 0,
					message: 'Permission name already exists in controller..'
				})
			}


			try {
				let data = await AuthPermission.create(authPermissionObj);

				res.status(200).send({
					success: 1,
					id: data.dataValues.id,
					message: "Auth permission created successfully."
				});
			} catch (err) {
				console.log(err);
				return res.send({
					success: 0,
					message: 'Error while create a Auth permission'
				})
			}
		},
		this.updateAuthPermission = async (req, res) => {
			let permissionId = req.params.id;
			let update = {};
			let whereCondition = {};
			update.modified_at = new Date();
			update.status = 1;
			if (!req.body.permission && !req.body.auth_controller_id) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}

			let idData = await AuthPermission.findOne({
				where: {
					id: permissionId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking auth permission id exists or not',
						error: err
					})
				})
			if (!idData) {
				return res.send({
					success: 0,
					message: 'Invalid auth permission '
				})
			} else {
				let whereCondition = {};
				if (req.body.permission) {
					update.permission = req.body.permission.trim();
					whereCondition.permission = req.body.permission.trim();
				} else {
					whereCondition.permission = idData.permission.trim();
				}
				if (req.body.auth_controller_id) {
					let controllerData = await AuthController.findOne({
						where: {
							id: req.body.auth_controller_id,
							status: 1
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking auth controller exists or not',
								error: err
							})
						})
					if (!controllerData) {
						return res.send({
							success: 0,
							message: 'Invalid auth controller id'
						})
					} else {
						update.auth_controller_id = req.body.auth_controller_id;
						whereCondition.auth_controller_id = req.body.auth_controller_id;
					}


				} else {
					whereCondition.auth_controller_id = idData.auth_controller_id;
				}
				whereCondition.status = 1;
				if (req.body.permission) {
					let permissionData = await AuthPermission.findOne({
						where: whereCondition
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking permission already exists or not',
								error: err
							})
						})
					if (permissionData && (permissionData.id !== permissionId)) {
						return res.send({
							success: 0,
							message: 'Permission already exists '
						})
					}
				}


				await AuthPermission.update(update, {
					where: {
						id: permissionId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating permission',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Permission updated successfully."
				});
			}


		},
		// this.listAuthPermission = async (req, res) => {
		// 	let params = req.query;
		// 	let page = params.page || 1;
		// 	let perPage = Number(params.per_page) || 10;
		// 	perPage = perPage > 0 ? perPage : 10;
		// 	var offset = (page - 1) * perPage;
		// 	let whereCondition = {};
		// 	// if (params.auth_controller_id) {
		// 	// 	let name_en = {
		// 	// 		[Op.like]: '%' + params.name + '%',
		// 	// 	};
		// 	// 	let name_ml = {
		// 	// 	  [Op.like]: '%' + params.name + '%'
		// 	// 	};
		// 	// 	whereCondition = Sequelize.or({name_en},{name_ml})
		// 	// }
		// 	whereCondition.status = 1;

		// 	var authPermissionData = await AuthPermission.findAll({
		// 		order: [
		// 			['modified_at', 'DESC']
		// 		],
		// 		offset: offset,
		// 		where: whereCondition,
		// 		include: [{
		// 			model: AuthController
		// 		}],

		// 		limit: perPage,
		// 	})
		// 		// .catch(err => {
		// 		// 	return res.send({
		// 		// 		success: 0,
		// 		// 		message: 'Something went wrong while fetching auth permission data',
		// 		// 		error: err
		// 		// 	})
		// 		// });

		// 	var count = await AuthPermission.count({
		// 		where: whereCondition,

		// 	})
		// 		.catch(err => {
		// 			return res.send({
		// 				success: 0,
		// 				message: 'Something went wrong while fetching auth permission count data',
		// 				error: err
		// 			})
		// 		});

		// 	totalPages = count / perPage;
		// 	totalPages = Math.ceil(totalPages);
		// 	var hasNextPage = page < totalPages;
		// 	let response = {
		// 		items: authPermissionData,
		// 		totalItems: count,
		// 		totalPages,
		// 		page,
		// 		perPage,
		// 		hasNextPage,
		// 		message: "Auth Permission listed successfully",
		// 		success: 1,
		// 	}
		// 	return res.send(response);
		// },


		this.getAuthPermission = async (req, res) => {
			let authPermissionId = req.params.id;
			let authPermissionData = await AuthPermission.findOne({
				where: {
					id: authPermissionId,
					status: 1
				},
				include: [{
					model: AuthController
				}],
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting auth permission data',
						error: err
					})
				})
			let response = {
				auth_permission: authPermissionData,
				success: 1,
			}
			return res.send(response);
		},
		this.deleteAuthPermission = async (req, res) => {
			let authPermissionId = req.params.id;
			let authPermissionData = await AuthPermission.findOne({
				where: {
					id: authPermissionId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting auth permission data',
						error: err
					})
				})
			if (authPermissionData) {
				let update = {
					status: 0
				}
				await AuthPermission.update(update, {
					where: {
						id: authPermissionId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while deleting auth permission',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Auth permission deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "Auth permission not exists."
				});
			}


		},


		this.createAuthRole = async (req, res) => {
			let params = req.body;

			if (!params.name) {
				var errors = [];

				if (!params.name) {
					errors.push({
						field: "name",
						message: 'Require name'

					});
				}

				return res.send({
					success: 0,
					statusCode: 400,
					errors: errors,
				});
			};
			var hasAssociationWithLsgi = params.has_association_with_lsgi ? params.has_association_with_lsgi : 0;
			var hasAssociationWithWard = params.has_association_with_ward ? params.has_association_with_ward : 0;
			var hasAssociationWithDistrict = params.has_association_with_district ? params.has_association_with_district : 0;
			var hasAssociationWithLsgiBlock = params.has_association_with_lsgi_block ? params.has_association_with_lsgi_block : 0;
			var isMobileSecretarySectionRole = params.is_mobile_secretary_section_role ? params.is_mobile_secretary_section_role : 0;

			let authRoleObj = {
				name: params.name.trim(),
				has_association_with_lsgi: hasAssociationWithLsgi,
				has_association_with_ward: hasAssociationWithWard,
				has_association_with_district: hasAssociationWithDistrict,
				has_association_with_lsgi_block: hasAssociationWithLsgiBlock,
				is_mobile_secretary_section_role: isMobileSecretarySectionRole,
				status: 1
			}
			let nameCheck = await AuthRole.findOne({
				where: {
					name: params.name.trim(),
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking auth role name exists or not',
						error: err
					})
				})
			if (nameCheck) {
				return res.send({
					success: 0,
					message: 'AuthRole name already exists..'
				})
			}
			if (params.is_mobile_secretary_section_role) {
				let mobileCheck = await AuthRole.findOne({
					where: {
						is_mobile_secretary_section_role: params.is_mobile_secretary_section_role,
						status: 1
					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while checking auth role is_mobile_secretary_section_role exists or not',
							error: err
						})
					})

				if (mobileCheck) {
					return res.send({
						success: 0,
						message: 'AuthRole name is_mobile_secretary_section_role exists..'
					})
				}
			}

			try {
				let data = await AuthRole.create(authRoleObj);

				res.status(200).send({
					success: 1,
					id: data.dataValues.id,
					message: "Auth role created successfully."
				});
			} catch (err) {
				console.log(err);
				return res.send({
					success: 0,
					message: 'Error while create a Auth role'
				})
			}
		},
		this.updateAuthRole = async (req, res) => {
			let authRoleId = req.params.id;
			let update = {};
			update.modified_at = new Date();
			update.status = 1;
			if (!req.body.name) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}
			if (req.body.name) {
				update.name = req.body.name.trim();
			}
			var params = req.body;
			if (params.is_mobile_secretary_section_role !== undefined) {
				update.is_mobile_secretary_section_role = params.is_mobile_secretary_section_role;
				update.is_mobile_secretary_section_role = update.is_mobile_secretary_section_role ? update.is_mobile_secretary_section_role : 0;
			}
			if (params.has_association_with_lsgi !== undefined) {
				update.has_association_with_lsgi = params.has_association_with_lsgi;
				update.has_association_with_lsgi = update.has_association_with_lsgi ? update.has_association_with_lsgi : 0;
			}
			if (params.has_association_with_ward !== undefined) {
				update.has_association_with_ward = params.has_association_with_ward;
				update.has_association_with_ward = update.has_association_with_ward ? update.has_association_with_ward : 0;
			}
			if (params.has_association_with_district !== undefined) {
				update.has_association_with_district = params.has_association_with_district;
				update.has_association_with_district = update.has_association_with_district ? update.has_association_with_district : 0;
			}
			if (params.has_association_with_lsgi_block !== undefined) {
				update.has_association_with_lsgi_block = params.has_association_with_lsgi_block;
				update.has_association_with_lsgi_block = update.has_association_with_lsgi_block ? update.has_association_with_lsgi_block : 0;
			}

			console.log("Update is");
			console.log(JSON.stringify(update));
			let idData = await AuthRole.findOne({
				where: {
					id: authRoleId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking auth role id exists or not',
						error: err
					})
				})
			if (!idData) {
				return res.send({
					success: 0,
					message: 'Invalid AuthRole Id'
				})
			} else {
				if (req.body.name) {
					let authRoleData = await AuthRole.findOne({
						where: {
							name: req.body.name.trim(),
							status: 1,
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking AuthRole name already exists or not',
								error: err
							})
						})
					if (authRoleData && (authRoleData.id !== authRoleId)) {
						return res.send({
							success: 0,
							message: 'AuthRole name already exists '
						})
					}
				}



				await AuthRole.update(update, {
					where: {
						id: authRoleId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating auth role name',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "AuthRole name updated successfully."
				});
			}


		},

		this.updateAuthRoleAndPermissions = async (req, res) => {
			console.log("Update auth roles permissions called...");
			let params = req.body;
			let authRoleId = req.params.id;

			console.log("Params received are ");
			console.log(JSON.stringify(params));

			let update = {};
			update.modified_at = new Date();
			update.status = 1;
			console.log("Params is " + JSON.stringify(params));
			if (!params.name && !params.permissions && !params.role_hierarchy) {
				return res.send({
					success: 1,
					message: 'Nothing to update'
				});
			}
			if (params.name) {
				update.name = params.name.trim();
				let authCheckData = await AuthRole.findOne({
					where: {
						name: params.name,
						id: { $not: authRoleId }
					}
				}).catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting auth role permission',
						error: err
					});
				});
				if (authCheckData && (authCheckData.id !== authRoleId)) {
					return res.send({
						success: 0,
						message: 'AuthRole name already exists '
					});
				}
				let authRoleUpdate = await AuthRole.update(update, {
					where: {
						id: authRoleId
					}
				}).catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while updating auth role name',
						error: err
					});
				});
			}
			if (params.role_hierarchy) {
				await Promise.all(params.role_hierarchy.map(async (item) => {


					if ((item.auth_role_id !== undefined) && (item.is_parent !== undefined)) {

						let whereCondition = {
							child_auth_role_id: authRoleId,
							parent_auth_role_id: item.auth_role_id,
							status: 1
						};

						let parentRoleData = await RoleHierarchy.findOne({
							where: whereCondition
						}).catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while updating role_heirarchy permission',
								error: err
							});
						});
						console.log("Parent role data is");
						console.log(JSON.stringify(parentRoleData));
						if (parentRoleData) {
							console.log("Permission already exists in db...");
							if (!item.is_parent) {
								console.log("Updating status to 0 in db...");
								await RoleHierarchy.update({
									status: 0
								}, {
									where: {
										child_auth_role_id: authRoleId,
										parent_auth_role_id: item.auth_role_id
									}
								}).catch(err => {
									return res.send({
										success: 0,
										message: 'Something went wrong while updating auth role permission',
										error: err
									})
								});
							}

						} else {
							console.log("Permission does not exist in db...");
							if (item.is_parent) {
								console.log("Request is to allow permission");
								let roleHierarchyObj = {
									child_auth_role_id: authRoleId,
									parent_auth_role_id: item.auth_role_id,
									status: 1
								}
								let data = await RoleHierarchy.create(roleHierarchyObj)
									.catch(err => {
										return res.send({
											success: 0,
											message: 'Something went wrong while create an auth role permission',
											error: err
										});
									});
								console.log("Permission entered in db...");
							}
						}
					}

				}));
			}
			if (params.permissions) {
				console.log("Permissions received..");
				await Promise.all(params.permissions.map(async (item) => {
					console.log("Processing " + JSON.stringify(item));
					if (item.id && item.is_allowed !== undefined) {
						console.log("Received permission entry is valid");
						let whereCondition = {
							role_id: authRoleId,
							auth_permission_id: item.id,
							status: 1
						};
						let authRoleData = await AuthRolePermission.findOne({
							where: whereCondition
						}).catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while updating auth role permission',
								error: err
							});
						});

						if (authRoleData) {
							console.log("Permission already exists in db...");
							if (!item.is_allowed) {
								console.log("Updating status to 0 in db...");
								await AuthRolePermission.update({
									status: 0
								}, {
									where: {
										id: authRoleData.id
									}
								}).catch(err => {
									return res.send({
										success: 0,
										message: 'Something went wrong while updating auth role permission',
										error: err
									})
								});
							}

						} else {
							console.log("Permission does not exist in db...");
							if (item.is_allowed) {
								console.log("Request is to allow permission");
								let rolePermissionObj = {
									role_id: authRoleId,
									auth_permission_id: item.id,
									status: 1
								}
								let data = await AuthRolePermission.create(rolePermissionObj)
									.catch(err => {
										return res.send({
											success: 0,
											message: 'Something went wrong while create an auth role permission',
											error: err
										});
									});
								console.log("Permission entered in db...");
							}
						}
					}

				}));
			}

			return res.status(200).send({
				success: 1,
				message: "AuthRole updated successfully."
			});
		},


		this.listAuthRole = async (req, res) => {
			let params = req.query;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			if (params.name) {
				whereCondition.name = {
					[Op.like]: '%' + params.name + '%',
				};

			}
			whereCondition.status = 1;

			var authRoles = await AuthRole.findAll({
				order: [
					['modified_at', 'DESC']
				],
				offset: offset,
				where: whereCondition,

				limit: perPage,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching authController data',
						error: err
					})
				});

			var count = await AuthRole.count({
				where: whereCondition,

			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching auth role count data',
						error: err
					})
				});

			totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: authRoles,
				total_items: count,
				has_next_page: hasNextPage,
				total_Pages: totalPages,
				page,
				per_page: perPage,
				message: "AuthRole listed successfully",
				success: 1,
			}
			return res.send(response);
		},


		this.getAuthRole = async (req, res) => {
			let authRoleId = req.params.id;
			let authRoleData = await AuthRole.findOne({
				where: {
					id: authRoleId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting auth role data',
						error: err
					})
				})
			let response = {
				authRole: authRoleData,
				success: 1,
			}
			return res.send(response);
		},
		this.getAuthRoleByName = async (req, res) => {
			let authRoleName = req.params.name;
			let authRoleData = await AuthRole.findOne({
				where: {
					name: authRoleName,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting auth role data',
						error: err
					})
				})
			let response = {
				authRole: authRoleData,
				success: 1,
			}
			return res.send(response);
		},
		this.deleteAuthRole = async (req, res) => {
			let authRoleId = req.params.id;
			let authRoleData = await AuthRole.findOne({
				where: {
					id: authRoleId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting authRole data',
						error: err
					})
				})
			if (authRoleData) {
				let update = {
					status: 0
				}
				await AuthRole.update(update, {
					where: {
						id: authRoleId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while deleting authRole',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "AuthRole deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "AuthRole not exists."
				});
			}


		},

		this.createAuthRolePermission = async (req, res) => {
			let params = req.body;

			if (!params.role_id || !params.auth_permission_id) {
				var errors = [];

				if (!params.role_id) {
					errors.push({
						field: "role_id",
						message: 'Require role id'

					});
				}

				if (!params.auth_permission_id) {
					errors.push({
						field: "auth_permission_id",
						message: 'Require auth permission id'

					});
				}

				return res.send({
					success: 0,
					statusCode: 400,
					errors: errors,
				});
			};


			let authRolePermissionObj = {
				auth_permission_id: params.auth_permission_id,
				role_id: params.role_id,
				status: 1
			}
			let namePermissionCheck = await AuthRolePermission.findOne({
				where: {
					auth_permission_id: params.auth_permission_id,
					role_id: params.role_id,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking auth role permission exists or not',
						error: err
					})
				})
			if (namePermissionCheck) {
				return res.send({
					success: 0,
					message: 'AuthRolePermission already exists..'
				})
			}
			let roleCheck = await AuthRole.findOne({
				where: {
					id: params.role_id,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking auth role exists or not',
						error: err
					})
				})
			if (!roleCheck) {
				return res.send({
					success: 0,
					message: 'Invalid Role..'
				})
			}

			let permissionCheck = await AuthPermission.findOne({
				where: {
					id: params.auth_permission_id,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking auth permission exists or not',
						error: err
					})
				})
			if (!permissionCheck) {
				return res.send({
					success: 0,
					message: 'Invalid Permission..'
				})
			}

			try {
				let data = await AuthRolePermission.create(authRolePermissionObj);

				res.status(200).send({
					success: 1,
					id: data.dataValues.id,
					message: "AuthRolePermission created successfully."
				});
			} catch (err) {
				console.log(err);
				return res.send({
					success: 0,
					message: 'Error while create a Auth role permission'
				})
			}
		},
		this.updateAuthRolePermission = async (req, res) => {
			let params = req.body;
			let authRolePermissionId = req.params.id;
			let update = {};
			update.modified_at = new Date();
			update.status = 1;
			if (!params.role_id && !params.auth_permission_id) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}
			let rolePermissionData = await AuthRolePermission.findOne({
				where: {
					id: authRolePermissionId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking auth role permission exists or not',
						error: err
					})
				})

			if (!rolePermissionData) {
				return res.send({
					success: 0,
					message: 'Invalid role permission..'
				})
			}
			let whereCondition = {};
			whereCondition.status = 1;
			if (params.role_id) {


				let roleCheck = await AuthRole.findOne({
					where: {
						id: params.role_id,
						status: 1
					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while checking auth role exists or not',
							error: err
						})
					})
				if (!roleCheck) {
					return res.send({
						success: 0,
						message: 'Invalid Role..'
					})
				} else {
					update.role_id = params.role_id;
					whereCondition.role_id = params.role_id;
				}

			} else {
				whereCondition.role_id = rolePermissionData.role_id;
			}
			if (params.auth_permission_id) {

				let permissionCheck = await AuthPermission.findOne({
					where: {
						id: params.auth_permission_id,
						status: 1
					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while checking auth permission exists or not',
							error: err
						})
					})
				if (!permissionCheck) {
					return res.send({
						success: 0,
						message: 'Invalid Permission..'
					})
				} else {
					update.auth_permission_id = params.auth_permission_id;
					whereCondition.auth_permission_id = params.auth_permission_id;

				}

			} else {
				whereCondition.auth_permission_id = rolePermissionData.auth_permission_id;
			}

			let idData = await AuthRolePermission.findOne({
				where: whereCondition
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking auth role permission exists or not',
						error: err
					})
				})
			if (idData) {
				return res.send({
					success: 0,
					message: 'Auth role permission already exists'
				})
			} else {

				await AuthRolePermission.update(update, {
					where: {
						id: authRolePermissionId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating auth role permission',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "AuthRolePermission updated successfully."
				});
			}


		},
		this.updateAuthRolePermissionWithRole = async (req, res) => {
			let params = req.body;
			let authRoleId = req.params.id;
			let update = {};
			update.modified_at = new Date();
			update.status = 1;
			if (!params.auth_permission_id) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}
			let whereCondition = {};
			// whereCondition.status = 1;
			if (authRoleId) {


				let roleCheck = await AuthRole.findOne({
					where: {
						id: authRoleId,
						status: 1
					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while checking auth role exists or not',
							error: err
						})
					})
				if (!roleCheck) {
					return res.send({
						success: 0,
						message: 'Invalid Role..'
					})
				} else {
					whereCondition.role_id = authRoleId;
				}

			} else {
				return res.send({
					success: 0,
					message: 'Role ID required..'
				})
			}
			// let rolePermissionData = await AuthRolePermission.findOne({
			// 	where: {
			// 		role_id: authRoleId,
			// 		// status: 1
			// 	}
			// })
			// 	.catch(err => {
			// 		return res.send({
			// 			success: 0,
			// 			message: 'Something went wrong while checking auth role permission exists or not',
			// 			error: err
			// 		})
			// 	})

			// if (!rolePermissionData) {
			// 	return res.send({
			// 		success: 0,
			// 		message: 'Invalid role permission..'
			// 	})
			// }


			let permissionCheck = await AuthPermission.findOne({
				where: {
					id: params.auth_permission_id,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking auth permission exists or not',
						error: err
					})
				})
			if (!permissionCheck) {
				return res.send({
					success: 0,
					message: 'Invalid Permission..'
				})
			} else {
				update.auth_permission_id = params.auth_permission_id;
				whereCondition.auth_permission_id = params.auth_permission_id;

			}


			let idData = await AuthRolePermission.findOne({
				where: whereCondition
			})
			// .catch(err => {
			// 	return res.send({
			// 		success: 0,
			// 		message: 'Something went wrong while checking auth role permission exists or not',
			// 		error: err
			// 	})
			// })
			if (idData) {
				console.log("status : " + idData.status)
				if (idData.status === 1) {
					return res.send({
						success: 0,
						message: 'Auth role permission already exists'
					})
				} else {

					await AuthRolePermission.update(update, {
						where: {
							role_id: authRoleId,
							auth_permission_id: params.auth_permission_id

						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while updating auth role permission',
								error: err
							})
						})
					res.status(200).send({
						success: 1,
						message: "AuthRolePermission updated successfully."
					});
				}
			} else {
				update.role_id = authRoleId;

				try {
					let data = await AuthRolePermission.create(update);

					res.status(200).send({
						success: 1,
						message: "AuthRolePermission updated successfully."
					});
				} catch (err) {
					console.log(err);
					return res.send({
						success: 0,
						message: 'Error while create a Auth role permission'
					})
				}

			}


		},
		this.listAuthPermission = async (req, res) => {
			let params = req.query;
			// let authRoleId = req.params.id;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			if (params.name) {
				whereCondition.name = {
					[Op.like]: '%' + params.name + '%',
				};

			}
			whereCondition.status = 1;


			var authPermissions = await AuthController.findAll({
				order: [
					['modified_at', 'DESC']
				],
				offset: offset,
				where: whereCondition,
				include: [{
					model: AuthPermission,
					as: 'permissions'
				}],

				limit: perPage,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching authController data',
						error: err
					})
				});

			// var count = await AuthRole.count({
			// 	where: whereCondition,

			// })
			// 	.catch(err => {
			// 		return res.send({
			// 			success: 0,
			// 			message: 'Something went wrong while fetching auth role count data',
			// 			error: err
			// 		})
			// 	});

			// totalPages = count / perPage;
			// totalPages = Math.ceil(totalPages);
			// var hasNextPage = page < totalPages;
			let response = {
				items: authPermissions,
				// totalItems: count,
				// hasNextPage,
				message: "AuthRole listed successfully",
				success: 1,
			}
			return res.send(response);
		},

		this.listAuthRolePermission = async (req, res) => {
			let params = req.query;
			let authRoleId = req.params.id;
			let userData = req.identity.data;
			let user_type = userData.user_type;
			let userId = userData.id;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			if (params.name) {
				whereCondition.name = {
					[Op.like]: '%' + params.name + '%',
				};

			}
			whereCondition.status = 1;





			// let authRoleCondition = {};
			// authRoleCondition.status=1;


			let authRolePermissionCondition = {};
			authRolePermissionCondition.status = 1;
			authRolePermissionCondition.role_id = authRoleId;
			let role = await AuthRole.findOne({
				where: {
					id: authRoleId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching AuthRole data',
						error: err
					})
				});
			if (!role) {
				return res.send({
					success: 0,
					message: 'Invalid Role',
				})
			}
			var authRolePermissions = await AuthRolePermission.findAll({
				order: [
					['modified_at', 'DESC']
				],
				// offset: offset,
				where: authRolePermissionCondition,
				// limit: perPage,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching authController data',
						error: err
					})
				});

			let roleHierarchyCondition = {
				status: 1,
				child_auth_role_id: authRoleId
			};
			roleHierarchy = await RoleHierarchy.findAll({
				order: [
					['modified_at', 'DESC']
				],
				// offset: offset,
				where: roleHierarchyCondition,
				// limit: perPage,
			})
				.catch(err => {
					return {
						success: 0,
						message: 'Something went wrong while fetching roleHierarchy data',
						error: err
					};
				});
			if (roleHierarchy && roleHierarchy.error) {
				return res.send(roleHierarchy);
			}


			var parentRoleIds = {};
			if (roleHierarchy) {
				var roleHierarchyTmp = JSON.stringify(roleHierarchy);
				roleHierarchyTmp = roleHierarchyTmp ? JSON.parse(roleHierarchyTmp) : [];
				roleHierarchy = roleHierarchyTmp;
			} else {
				roleHierarchy = [];
			}
			var pRIdx = 0;
			var pRLen = roleHierarchy.length;
			var pRTmp;


			while (pRIdx < pRLen) {
				pRTmp = roleHierarchy[pRIdx];
				pRTmp = pRTmp.parent_auth_role_id;
				parentRoleIds[pRTmp] = true;
				pRIdx++;
			}
			var roleHierarchy = roleHierarchy;
			var allAuthRoles = await AuthRole.findAll({
				order: [
					['modified_at', 'DESC']
				],
				// offset: offset,
				where: { status: 1 },
				// limit: perPage,
			}).catch(err => {
				return {
					success: 0,
					message: 'Something went wrong while fetching authController data',
					error: err
				};
			});

			if (allAuthRoles && allAuthRoles.error) {
				return res.send(allAuthRoles);
			}
			var roleHierarchyList = {};
			var roleCount = allAuthRoles.length;
			var idx = 0;
			var authRoleTmp;
			var rId;
			while (idx < roleCount) {
				authRoleTmp = allAuthRoles[idx];
				rId = authRoleTmp.id;
				if (!roleHierarchyList[rId]) {
					roleHierarchyList[rId] = {
						auth_role_id: rId,
						name: authRoleTmp.name,
						is_parent: false
					};
				}
				roleHierarchyList[rId].is_parent = (parentRoleIds[rId] !== undefined);
				idx++;
			}
			roleHierarchy = Object.values(roleHierarchyList);
			var authControllerPermissions = await AuthController.findAll({
				order: [
					['modified_at', 'DESC']
				],
				// offset: offset,
				where: whereCondition,
				include: [{
					model: AuthPermission,
					as: 'permissions',
					where: { status: 1 }
				}],

				// limit: perPage,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching authController data',
						error: err
					})
				});





			let authPermissionIdArray = [];
			let authRolePermissionObj = {};
			var itm;
			var pid;
			for (let i = 0; i < authRolePermissions.length; i++) {
				itm = authRolePermissions[i];
				pid = itm.auth_permission_id;
				authPermissionIdArray.push(authRolePermissions[i].auth_permission_id);
				authRolePermissionObj[pid] = true;
			}
			var j = 0;
			// let responseArray = authControllerPermissions.map(function(item){ return item.toJSON() });

			let responseArray = authControllerPermissions.map(function (item) { return item.toJSON() });
			//console.log("Permissions obj: ");
			//console.log(JSON.stringify(authRolePermissionObj));
			for (let j = 0; j < responseArray.length; j++) {
				let controller = responseArray[j];
				let k = 0;
				for (let k = 0; k < controller.permissions.length; k++) {
					let obj = controller.permissions[k];
					//console.log("User type is " + user_type);
					pid = controller.permissions[k].id;
					//console.log("Checking permission  " + pid + " in permissions obj");
					//let optionObj = await authPermissionIdArray.find(id => id === controller.permissions[k].id);
					obj['is_allowed'] = authRolePermissionObj[pid] ? true : false;
					// if (optionObj) {

					// 	obj["is_allowed"] = true;
					// } else {
					// 	obj["is_allowed"] = false;

					// }

					responseArray[j].permissions[k] = obj;
				}
			}

			// var count = await AuthRole.count({
			// 	where: whereCondition,

			// })
			// 	.catch(err => {
			// 		return res.send({
			// 			success: 0,
			// 			message: 'Something went wrong while fetching auth role count data',
			// 			error: err
			// 		})
			// 	});

			// totalPages = count / perPage;
			// totalPages = Math.ceil(totalPages);
			// var hasNextPage = page < totalPages;
			let response = {
				controllers: responseArray,
				role_hierarchy: roleHierarchy,
				// totalItems: count,
				// hasNextPage,
				name: role.name,
				message: "AuthRolePermission listed successfully",
				success: 1,
			}
			return res.send(response);
		},


		this.deleteAuthRolePermission = async (req, res) => {
			let authRolePermissionId = req.params.id;
			let authRolePermissionData = await AuthRolePermission.findOne({
				where: {
					id: authRolePermissionId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting authRole permission data',
						error: err
					})
				})
			if (authRolePermissionData) {
				let update = {
					status: 0
				}
				await AuthRolePermission.update(update, {
					where: {
						id: authRolePermissionId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while deleting authRolePermission',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "AuthRolePermission deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "AuthRolePermission not exists."
				});
			}


		},



		this.createAuthPermissionSidebarMenu = async (req, res) => {
			let params = req.body;

			if (!params.auth_permission_id || !params.sidebar_menu_id) {
				var errors = [];

				if (!params.auth_permission_id) {
					errors.push({
						field: "auth_permission_id",
						message: 'Require auth permission id'

					});
				}

				if (!params.sidebar_menu_id) {
					errors.push({
						field: "sidebar_menu_id",
						message: 'Require sidebar menu id'

					});
				}

				return res.send({
					success: 0,
					statusCode: 400,
					errors: errors,
				});
			};


			let authPermissionSidebarObj = {
				auth_permission_id: params.auth_permission_id,
				auth_sidebar_menu_id: params.sidebar_menu_id,
				status: 1
			}
			let menuCheck = await SidebarMenu.findOne({
				where: {
					id: params.sidebar_menu_id,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking sidebarmenu exists or not',
						error: err
					})
				})
			if (!menuCheck) {
				return res.send({
					success: 0,
					message: 'Invalid sidebarmenu'
				})
			}

			let permissionCheck = await AuthPermission.findOne({
				where: {
					id: params.auth_permission_id,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking auth permission exists or not',
						error: err
					})
				})
			if (!permissionCheck) {
				return res.send({
					success: 0,
					message: 'Invalid permission'
				})
			}


			try {
				let data = await AuthPermissionSidebarMenu.create(authPermissionSidebarObj);

				res.status(200).send({
					success: 1,
					id: data.dataValues.id,
					message: "Auth permission sidebarmenu created successfully."
				});
			} catch (err) {
				console.log(err);
				return res.send({
					success: 0,
					message: 'Error while create a Auth permission sidebarmenu '
				})
			}
		},
		this.updateAuthPermissionSidebarMenu = async (req, res) => {
			let authPermissionSidebarMenuId = req.params.id;
			let params = req.body;
			let update = {};
			update.modified_at = new Date();
			update.status = 1;
			if (!params.auth_permission_id && !params.sidebar_menu_id) {

				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}


			let idData = await AuthPermissionSidebarMenu.findOne({
				where: {
					id: authPermissionSidebarMenuId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking authPermissionSidebarMenuId exists or not',
						error: err
					})
				})
			if (!idData) {
				return res.send({
					success: 0,
					message: 'Invalid authPermissionSidebarMenuId'
				})
			} else {
				let authPermissionId;
				let sideBarMenuId;
				if (params.auth_permission_id) {


					let permissionCheck = await AuthPermission.findOne({
						where: {
							id: params.auth_permission_id,
							status: 1
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking auth permission exists or not',
								error: err
							})
						})
					if (!permissionCheck) {
						return res.send({
							success: 0,
							message: 'Invalid permission'
						})
					} else {
						update.auth_permission_id = params.auth_permission_id;
						authPermissionId = params.auth_permission_id
					}

				} else {
					authPermissionId = idData.auth_permission_id
				}
				if (params.sidebar_menu_id) {
					let menuCheck = await SidebarMenu.findOne({
						where: {
							id: params.sidebar_menu_id,
							status: 1
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking sidebarmenu exists or not',
								error: err
							})
						})
					if (!menuCheck) {
						return res.send({
							success: 0,
							message: 'Invalid sidebarmenu'
						})
					} else {
						update.sidebar_menu_id = params.sidebar_menu_id;
						sideBarMenuId = params.sidebar_menu_id
					}

				} else {
					sideBarMenuId = idData.sidebar_menu_id
				}
				let authPermissionSidebarMenuData = await AuthPermissionSidebarMenu.findOne({
					where: {
						sidebar_menu_id: sideBarMenuId,
						auth_permission_id: authPermissionId,
						status: 1,
					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while checking AuthPermissionSidebarMenu name already exists or not',
							error: err
						})
					})
				if (authPermissionSidebarMenuData && (authPermissionSidebarMenuData.id !== authPermissionSidebarMenuId)) {
					return res.send({
						success: 0,
						message: 'AuthPermissionSidebarMenu name already exists '
					})
				}
			}



			await AuthPermissionSidebarMenu.update(update, {
				where: {
					id: authPermissionSidebarMenuId

				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while updating AuthPermissionSidebarMenu',
						error: err
					})
				})
			res.status(200).send({
				success: 1,
				message: "AuthPermissionSidebarMenu updated successfully."
			});



		},
		this.listAuthPermissionSidebarMenu = async (req, res) => {
			let params = req.query;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			// if (params.name) {
			// 	whereCondition.name = {
			// 		[Op.like]: '%' + params.name + '%',
			// 	};

			// }
			whereCondition.status = 1;

			var authPermissionSidebarMenuData = await AuthPermissionSidebarMenu.findAll({
				order: [
					['modified_at', 'DESC']
				],
				offset: offset,
				where: whereCondition,
				include: [{
					model: AuthPermission
				}, {
					model: SidebarMenu
				}],

				limit: perPage,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching authPermissionSidebarMenuData data',
						error: err
					})
				});

			var count = await AuthPermissionSidebarMenu.count({
				where: whereCondition,

			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching authPermissionSidebarMenuData count data',
						error: err
					})
				});

			totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: authPermissionSidebarMenuData,
				total_items: count,
				total_pages: totalPages,
				page,
				per_page: perPage,
				has_next_page: hasNextPage,
				message: "authPermissionSidebarMenu listed successfully",
				success: 1,
			}
			return res.send(response);
		},


		this.getAuthPermissionSidebarMenu = async (req, res) => {
			let authPermissionSidebarMenuId = req.params.id;
			let authPermissionSidebarMenuData = await AuthPermissionSidebarMenu.findOne({
				where: {
					id: authPermissionSidebarMenuId,
					status: 1
				},
				include: [{
					model: AuthPermission
				}, {
					model: SidebarMenu
				}],
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting authPermissionSidebarMenu data',
						error: err
					})
				})
			let response = {
				authPermissionSidebarMenu: authPermissionSidebarMenuData,
				success: 1,
			}
			return res.send(response);
		},
		this.deleteAuthPermissionSidebarMenu = async (req, res) => {
			let authPermissionSidebarMenuId = req.params.id;
			let authPermissionSidebarMenuData = await AuthPermissionSidebarMenu.findOne({
				where: {
					id: authPermissionSidebarMenuId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting authPermissionSidebarMenuData',
						error: err
					})
				})
			if (authPermissionSidebarMenuData) {
				let update = {
					status: 0
				}
				await AuthPermissionSidebarMenu.update(update, {
					where: {
						id: authPermissionSidebarMenuId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while deleting authPermissionSidebarMenu',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "authPermissionSidebarMenu deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "authPermissionSidebarMenu not exists."
				});
			}


		}






	//Lsgi Block
	this.createLsgiBlock = async (req, res) => {
		let params = req.body;

		if (!params.name_ml || !params.name_en || !params.district_id) {
			var errors = [];

			if (!params.name_ml) {
				errors.push({
					field: "name_ml",
					message: 'Require block Malayalam name'

				});
			}
			if (!params.name_en) {
				errors.push({
					field: "name_en",
					message: 'Require block English name'
				});
			}

			if (!params.district_id) {
				errors.push({
					field: "district_id",
					message: 'Require district id'
				});
			}

			return res.send({
				success: 0,
				statusCode: 400,
				errors: errors,
			});
		};


		let lsgiBlockObj = {
			name_ml: params.name_ml.trim(),
			name_en: params.name_en.trim(),
			district_id: params.district_id,
			status: 1
		}

		let districtCheck = await District.findOne({
			where: {
				id: params.district_id,
				status: 1
			}
		})
			.catch(err => {
				return res.send({
					success: 0,
					message: 'Something went wrong while checking district exists or not',
					error: err
				})
			})
		if (!districtCheck) {
			return res.send({
				success: 0,
				message: 'Invalid district..'
			})
		}

		let nameMlCheck = await LsgiBlock.findOne({
			where: {
				name_ml: params.name_ml.trim(),
				district_id: params.district_id,
				status: 1
			}
		})
			.catch(err => {
				return res.send({
					success: 0,
					message: 'Something went wrong while checking malayalam lsgi block name exists or not',
					error: err
				})
			})
		if (nameMlCheck) {
			return res.send({
				success: 0,
				message: 'Lsgi block malayalam name already exists..'
			})
		}

		let nameEnCheck = await LsgiBlock.findOne({
			where: {
				name_en: params.name_en.trim(),
				district_id: params.district_id,
				status: 1
			}
		})
			.catch(err => {
				return res.send({
					success: 0,
					message: 'Something went wrong while checking english lsgi block name exists or not',
					error: err
				})
			})
		if (nameEnCheck) {
			return res.send({
				success: 0,
				message: 'Lsgi block english name already exists..'
			})
		}
		try {
			let data = await LsgiBlock.create(lsgiBlockObj);

			res.status(200).send({
				success: 1,
				id: data.dataValues.id,
				message: "Lsgi block created successfully."
			});
		} catch (err) {
			console.log(err);
			return res.send({
				success: 0,
				message: 'Error while create a Lsgi block'
			})
		}
	},
		this.updateLsgiBlock = async (req, res) => {
			let lsgiBlockId = req.params.id;
			let update = {};
			update.modified_at = new Date();
			update.status = 1;
			if (!req.body.name_ml && !req.body.name_en && !req.body.district_id) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}

			let idData = await LsgiBlock.findOne({
				where: {
					id: lsgiBlockId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking lsgi block id exists or not',
						error: err
					})
				})
			if (!idData) {
				return res.send({
					success: 0,
					message: 'Invalid lsgi block '
				})
			}

			let districtId;
			if (req.body.district_id) {
				let districtCheck = await District.findOne({
					where: {
						id: req.body.district_id,
						status: 1
					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while checking district exists or not',
							error: err
						})
					})
				if (!districtCheck) {
					return res.send({
						success: 0,
						message: 'Invalid district..'
					})
				} else {
					update.district_id = req.body.district_id;
					districtId = req.body.district_id;
				}
			} else {
				districtId = idData.district_id;
			}
			if (req.body.name_ml) {

				let nameMlCheck = await LsgiBlock.findOne({
					where: {
						name_ml: req.body.name_ml.trim(),
						district_id: req.body.district_id,
						status: 1
					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while checking malayalam lsgi block name exists or not',
							error: err
						})
					})
				if (nameMlCheck && (nameMlCheck.id !== lsgiBlockId)) {
					return res.send({
						success: 0,
						message: 'Lsgi block malayalam name already exists..'
					})
				} else {
					update.name_ml = req.body.name_ml.trim();

				}



			}
			if (req.body.name_en) {
				let nameEnCheck = await LsgiBlock.findOne({
					where: {
						name_en: req.body.name_en.trim(),
						district_id: req.body.district_id,
						status: 1
					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while checking english lsgi block name exists or not',
							error: err
						})
					})
				if (nameEnCheck && (nameEnCheck.id !== lsgiBlockId)) {
					return res.send({
						success: 0,
						message: 'Lsgi block english name already exists..'
					})
				} else {
					update.name_en = req.body.name_en.trim();

				}
			}


			await LsgiBlock.update(update, {
				where: {
					id: lsgiBlockId

				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while updating lsgi block name',
						error: err
					})
				})
			res.status(200).send({
				success: 1,
				message: "Lsgi block name updated successfully."
			});
			// }


		},
		this.listLsgiBlock = async (req, res) => {
			let params = req.query;
			let page = params.page;
			let perPage = Number(params.per_page);
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			if (params.name) {
				let name_en = {
					[Op.like]: '%' + params.name + '%',
				};
				let name_ml = {
					[Op.like]: '%' + params.name + '%'
				};
				whereCondition = Sequelize.or({ name_en }, { name_ml })
			}
			if (params.district_id) {
				whereCondition.district_id = params.district_id;
			}
			whereCondition.status = 1;
			let userDataz = req.identity.data;
			if (userDataz.district_id && userDataz.district_id != null) {
				whereCondition.district_id = userDataz.district_id;
			}
			// if(userDataz.lsgi_id && userDataz.lsgi_id!=null){
			// 	whereCondition.lsgi_id=userDataz.lsgi_id;
			// }
			if (userDataz.lsgi_block_id && userDataz.lsgi_block_id != null) {
				whereCondition.id = userDataz.lsgi_block_id;
			}
			// if(userDataz.ward_id && userDataz.ward_id!=null){
			// 	whereCondition.ward_id=userDataz.ward_id;
			// }

			let objLsgiBlock = {
				order: [
					['modified_at', 'DESC']
				],
				where: whereCondition,
				include: [{
					model: District
				}]
			}

			if (params.per_page) {
				objLsgiBlock.limit = perPage;
			}
			if (page && params.per_page) {
				objLsgiBlock.offset = offset;
				objLsgiBlock.limit = perPage;
			}


			var lsgisBlocks = await LsgiBlock.findAll(objLsgiBlock)
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching lsgi block data',
						error: err
					})
				});

			var count = await LsgiBlock.count({
				where: whereCondition,

			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching lsgi block count data',
						error: err
					})
				});

			totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: lsgisBlocks,
				total_pages: totalPages,
				page,
				per_page: perPage,
				total_items: count,
				has_next_page: hasNextPage,
				message: "Lsgi block listed successfully",
				success: 1,
			}
			return res.send(response);
		},


		this.getLsgiBlock = async (req, res) => {
			let lsgiBlockId = req.params.id;
			let lsgiBlockData = await LsgiBlock.findOne({
				where: {
					id: lsgiBlockId,
					status: 1
				},
				include: [{
					model: District
				}]
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting lsgi block data',
						error: err
					})
				})
			let response = {
				lsgiBlock: lsgiBlockData,
				success: 1,
			}
			return res.send(response);
		},
		this.deleteLsgiBlock = async (req, res) => {
			let lsgiBlockId = req.params.id;
			let lsgiBlockData = await LsgiBlock.findOne({
				where: {
					id: lsgiBlockId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting lsgi block data',
						error: err
					})
				})
			if (lsgiBlockData) {
				let update = {
					status: 0
				}
				await LsgiBlock.update(update, {
					where: {
						id: lsgiBlockId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while deleting lsgi block',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Lsgi block deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "Lsgi block not exists."
				});
			}


		},




		this.createOfficeType = async (req, res) => {
			let params = req.body;

			if (!params.name) {
				var errors = [];

				if (!params.name_ml) {
					errors.push({
						field: "name",
						message: 'Require office name'

					});
				}

				return res.send({
					success: 0,
					statusCode: 400,
					errors: errors,
				});
			};


			let officeTypeObj = {
				name: params.name.trim(),
				status: 1
			}
			let nameCheck = await OfficeType.findOne({
				where: {
					name: params.name.trim(),
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking office type name exists or not',
						error: err
					})
				})
			if (nameCheck) {
				return res.send({
					success: 0,
					message: 'Office type name already exists..'
				})
			}

			try {
				let data = await OfficeType.create(officeTypeObj);

				res.status(200).send({
					success: 1,
					id: data.dataValues.id,
					message: "Office Type created successfully."
				});
			} catch (err) {
				console.log(err);
				return res.send({
					success: 0,
					message: 'Error while create a Office Type'
				})
			}
		},
		this.updateOfficeType = async (req, res) => {
			let officeTypeId = req.params.id;
			let update = {};
			update.modified_at = new Date();
			update.status = 1;
			if (!req.body.name) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}
			if (req.body.name) {
				update.name = req.body.name.trim();
			}

			let idData = await OfficeType.findOne({
				where: {
					id: officeTypeId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking officeType id exists or not',
						error: err
					})
				})
			if (!idData) {
				return res.send({
					success: 0,
					message: 'Invalid officeType '
				})
			} else {
				if (req.body.name) {
					let officeTypeData = await OfficeType.findOne({
						where: {
							name: req.body.name.trim(),
							status: 1,
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking officeType name already exists or not',
								error: err
							})
						})
					if (officeTypeData && (officeTypeData.id !== officeTypeId)) {
						return res.send({
							success: 0,
							message: 'OfficeType name already exists '
						})
					}
				}


				await OfficeType.update(update, {
					where: {
						id: officeTypeId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating officeType name',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "OfficeType name updated successfully."
				});
			}


		},
		this.listOfficeType = async (req, res) => {
			let params = req.query;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			if (params.name) {
				let name = {
					[Op.like]: '%' + params.name + '%',
				};

				whereCondition = name;
			}
			whereCondition.status = 1;

			var officeTypes = await OfficeType.findAll({
				order: [
					['modified_at', 'DESC']
				],
				offset: offset,
				where: whereCondition,

				limit: perPage,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching office type data',
						error: err
					})
				});

			var count = await OfficeType.count({
				where: whereCondition,

			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching office type count data',
						error: err
					})
				});

			totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: officeTypes,
				total_items: count,
				total_pages: totalPages,
				page,
				per_page: perPage,
				has_next_page: hasNextPage,
				message: "Office types listed successfully",
				success: 1,
			}
			return res.send(response);
		},


		this.getOfficeType = async (req, res) => {
			let officeTypeId = req.params.id;
			let officeTypeData = await OfficeType.findOne({
				where: {
					id: officeTypeId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting office type data',
						error: err
					})
				})
			let response = {
				officeType: officeTypeData,
				success: 1,
			}
			return res.send(response);
		},
		this.deleteOfficeType = async (req, res) => {
			let officeTypeId = req.params.id;
			let officeTypeData = await OfficeType.findOne({
				where: {
					id: officeTypeId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting office type data',
						error: err
					})
				})
			if (officeTypeData) {
				let update = {
					status: 0
				}
				await OfficeType.update(update, {
					where: {
						id: officeTypeId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while deleting office type',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Office type deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "Office type not exists."
				});
			}


		},




		this.updateSettings = async (req, res) => {

			var userData = req.identity;
			var userId = userData.data.id;
			let update = {};
			update.modified_at = new Date();
			update.status = 1;
			// if (!req.body.resurvey_period_days || !req.body.default_pagination_limit || !req.body.survey_closing_date || !req.body.about_content)  {
			// 	return res.send({
			// 		success: 0,
			// 		message: 'Nothing to update'
			// 	})
			// }
			if (req.body.resurvey_period_days) {
				update.resurvey_period_days = req.body.resurvey_period_days;
			}
			if (req.body.default_pagination_limit) {
				update.default_pagination_limit = req.body.default_pagination_limit;
			}
			if (req.body.survey_closing_date) {
				update.survey_closing_date = req.body.survey_closing_date;
			}
			if (req.body.about_content) {
				update.about_content = req.body.about_content;
			}
		let	resurvey_period_days = req.body.resurvey_period_days;

			let idData = await Settings.findOne({
				where: {
					id: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking settings id exists or not',
						error: err
					})
				})

			if (!idData) {
				return res.send({
					success: 0,
					message: 'Invalid settings id '
				})
			} else {
				let currentSurveyDate = idData.survey_closing_date;
				await Settings.update(update, {
					where: {
						id: 1

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating Settings',
							error: err
						})
					})
			
			// Update Survey with new Survey Closing date
				await Survey.update({
					survey_closing_date: req.body.survey_closing_date
				}, {
					where: {
						status: 1,
						survey_closing_date: currentSurveyDate
					}
				}).catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while updating Survey Tables "survey_closing_date" ',
						error: err
					})
				})
			//update SettingHistory when user change in UI
				update.settings_id = idData.id;
				update.user_id = userId;
				
				let data = await SettingsHistory.create(update)
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while create an SettingsHistory',
						error: err
					});
				});
					
				res.status(200).send({
					success: 1,
					message: "Settings updated successfully."
				});
			}
		
		},

		this.getSettings = async (req, res) => {
			var settingData = {
				id: null,
				survey_closing_date: null,
				resurvey_period_days: null,
				default_pagination_limit: null,
				about_content: null,
				created_at: null,
				modified_at: null
			};
			var userData = req.identity;
			var userId = userData.data.id;
			let settingsData = await Settings.findOne({
				where: {
					id: 1,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting settingsData',
						error: err
					})
				})
			if (settingsData != null) {
				settingData.id = settingsData.id;
				settingData.survey_closing_date = settingsData.survey_closing_date;
				settingData.resurvey_period_days = settingsData.resurvey_period_days;
				settingData.default_pagination_limit = settingsData.default_pagination_limit;
				settingData.about_content = settingsData.about_content;
				settingData.created_at = settingsData.created_at;
				settingData.modified_at = settingsData.modified_at;


			}

			let response = {
				settings: settingData,
				success: 1,
			}
			return res.send(response);
		}
	this.getUsersListSubMenus = async (roleId) => {
		var subMenus = [];
		var childRoles = await RoleHierarchy.findAll({
			where: {
				parent_auth_role_id: roleId,
				status: 1
			},
			include: [
				{
					model: AuthRole,
					as: 'childAuthRole',
					where: { status: 1 }
				}
			],
			order: [
				['childAuthRole', 'name', 'ASC'],
			],

		})
			.catch(err => {
				return [];
			});

		var i = 0;
		var ln = childRoles.length;
		var role;
		var rName;
		var rId;
		var rLink;
		var menuObj;
		while (i < ln) {
			role = childRoles[i];
			i++;
			if (!(role && role.childAuthRole)) {
				continue;
			}
			role = role.childAuthRole;

			rName = role.name;
			rId = role.id;
			rLink = `/users/${rName}`;
			menuObj = {
				id: rId,
				name: rName,
				link: rLink
			};
			subMenus.push(menuObj);
		}

		return subMenus;

	},

		this.sortMenuItems = (menuItems) => {

			menuItems.sort(function (a, b) {
				a.sort_order = a.sort_order ? a.sort_order : 0;
				b.sort_order = b.sort_order ? b.sort_order : 0;

				if (a.sort_order < b.sort_order) {
					return -1;
				}
				if (a.sort_order > b.sort_order) {
					return 1;
				}
				return 0;
			});
			return menuItems;
		},
		this.listUsersSidbarMenu = async (req, res) => {
			var that = this;
			var userData = req.identity;
			var userId = userData.data.id;
			let userCheckData = await User.findOne({
				where: {
					id: userId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting user data',
						error: err
					})
				})
			if (!userCheckData) {
				return res.send({
					success: 0,
					message: 'Invalid user',

				})
			}
			let role_id;
			if (!userCheckData.role_id) {
				return res.send({
					success: 0,
					message: 'Invalid role user',

				})
			}
			role_id = userCheckData.role_id;
			let authRolePermissions = await AuthRolePermission.findAll({
				where: {
					role_id: role_id,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting role permission data',
						error: err
					})
				})
			let permissionIds = [];
			for (let i = 0; i < authRolePermissions.length; i++) {
				permissionIds.push(authRolePermissions[i].auth_permission_id)
			}
			let whereCondition = {
				status: 1
			}
			whereCondition.auth_permission_id = {
				[Op.in]: permissionIds
			}
			let autherizedSideBarMenuIds = await AuthPermissionSidebarMenu.findAll({
				where: whereCondition,
				attributes: ['sidebar_menu_id']
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting sidebarmenu permission data',
						error: err
					})
				});
			var sidebarMenuIds = [];
			for (let i = 0; i < autherizedSideBarMenuIds.length; i++) {
				sidebarMenuIds.push(autherizedSideBarMenuIds[i].dataValues.sidebar_menu_id)
			}
			var allSideBarMenus = await SidebarMenu.findAll({
				where: {
					status: 1
				},
				order: [
					['id', 'ASC'],
				],
			}).catch(err => {
				return res.send({
					success: 0,
					message: 'Something went wrong while getting all sidebarmenus data',
					error: err
				})
			});
			var userListSidebarMenuSubMenus = {};
			var childRoleMenus = null;
			let responseArray = allSideBarMenus.map(function (item) { return item.toJSON() });
			let temp = responseArray;
			for (let i = 0; i < temp.length; i++) {
				let item = temp[i];
				let menuIdTmp = item.id;
				if (sidebarMenuIds.indexOf(menuIdTmp) === -1) {
					responseArray = responseArray.filter(x => {
						return x.id != menuIdTmp;
					})
				} else {
					if (item.is_user_list_main_menu) {
						if (!childRoleMenus) {
							childRoleMenus = await that.getUsersListSubMenus(role_id);
						}
						userListSidebarMenuSubMenus[menuIdTmp] = childRoleMenus;
					}
				}
			}

			var listSidebarMenuData = [];
			for (let i = 0; i < responseArray.length; i++) {
				let item = responseArray[i];
				let sMenuId = item.id;
				if (item.parent_sidebar_menu_id === null) {
					item.sub_menus = [];
					if ((item.is_user_list_main_menu == 1) && userListSidebarMenuSubMenus[sMenuId]) {
						item.sub_menus = userListSidebarMenuSubMenus[sMenuId];
					}
					listSidebarMenuData.push(item);
				}
			}
			that.sortMenuItems(listSidebarMenuData);


			for (let j = 0; j < listSidebarMenuData.length; j++) {
				let item = listSidebarMenuData[j];

				let obj = responseArray.filter(x => x.parent_sidebar_menu_id === item.id);

				for (let k = 0; k < obj.length; k++) {
					if (obj[k]) {
						listSidebarMenuData[j].sub_menus.push(obj[k]);
					}
				}
				that.sortMenuItems(listSidebarMenuData[j].sub_menus);

			}
			let responseObj = {
				sidebar_menu: listSidebarMenuData,
				success: 1,
				message: "Listed sidebar menus"
			}

			return res.send(responseObj);






		},


		this.getDashboards = async (req, res) => {
			let whereCondition = {
				status: 1
			}
			let facilitywhereCondition = {
				status: 1
			}
			let gradecondition = {}
			let typewhereCondition = {};
			let params = req.query;
			let otherCondition = {};
			var lsgiId;
			if (params.district_id) {
				whereCondition.district_id = params.district_id
				gradecondition.district_id = params.district_id
				facilitywhereCondition.district_id = params.district_id
				typewhereCondition.district_id = params.district_id
			}
			let lsgicon = { status: 1 }
			if (params.lsgi_type_id) {
				whereCondition.lsgi_type_id = params.lsgi_type_id
				lsgicon.lsgi_type_id = params.lsgi_type_id
			}
			if (params.lsgi_id) {
				whereCondition.lsgi_id = params.lsgi_id
				gradecondition.lsgi_id = params.lsgi_id
				facilitywhereCondition.lsgi_id = params.lsgi_id;
				typewhereCondition.lsgi_id = params.lsgi_id;
			}
			if (params.lsgi_block_id) {
				whereCondition.lsgi_block_id = params.lsgi_block_id
				gradecondition.lsgi_block_id = params.lsgi_block_id
				facilitywhereCondition.lsgi_block_id = params.lsgi_block_id
				typewhereCondition.lsgi_block_id = params.lsgi_block_id
			}
			if (params.lsgi) {
				let nameEnObj = {
					name_en: lsgi,
				};
				let nameMlObj = {
					name_ml: lsgi
				};
				let findCriteria = Sequelize.or(nameEnObj, nameMlObj)
				findCriteria.status = 1
				let lsgiData = await Lsgi.findOne({
					where: findCriteria
				}).catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting Lsgis ',
					})
				})
				lsgiId = lsgiData.id;
				whereCondition.lsgi_id = lsgiId;
			}
			if (params.grade) {
				otherCondition.grade = params.grade
				whereCondition.grade = params.grade
			}
			if (params.grade) {
				otherCondition.facility = params.grade
			}

			let userDataz = req.identity.data;
			if (userDataz.district_id && userDataz.district_id != null) {
				whereCondition.district_id = userDataz.district_id;
				gradecondition.district_id = userDataz.district_id;
				facilitywhereCondition.district_id = userDataz.district_id;
				typewhereCondition.district_id = userDataz.district_id;
			}
			if (userDataz.lsgi_id && userDataz.lsgi_id != null) {
				whereCondition.lsgi_id = userDataz.lsgi_id;
				gradecondition.lsgi_id = userDataz.lsgi_id;
				facilitywhereCondition.lsgi_id = userDataz.lsgi_id;
				typewhereCondition.lsgi_id = userDataz.lsgi_id;
			}
			if (userDataz.lsgi_block_id && userDataz.lsgi_block_id != null) {
				whereCondition.lsgi_block_id = userDataz.lsgi_block_id;
				gradecondition
					.lsgi_block_id = userDataz.lsgi_block_id;
				facilitywhereCondition.lsgi_block_id = userDataz.lsgi_block_id;
				typewhereCondition.lsgi_block_id = userDataz.lsgi_block_id;
			}
			// if(userDataz.ward_id && userDataz.ward_id!=null){
			// 	whereCondition.ward_id=userDataz.ward_id;
			// }

			whereCondition.is_active = 1;
			let activated_lsgi_count = await Survey.count({
				where: whereCondition
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting Lsgis ',
					})
				})
			delete whereCondition.is_active;
			delete whereCondition.grade;


			// let categorywise_survey_count = [];

			// let categories = await Category.findAll({
			// 	where : whereCondition,
			// 	attributes : ['id' , 'name_en', 'name_ml']
			// })
			// .catch(err => {
			// 	return res.send({
			// 		success: 0,
			// 		message: 'Something went wrong while getting categories',
			// 	})
			// })


			// let categoryIds = [];
			// for(let i = 0; i < categories.length; i++){
			//   let item = categories[i];	
			//   categoryIds.push(item.id);
			// }
			//  await Promise.all(categories.map(async (item) => {
			// 	 let id = item.id;
			// 	 await FacilityType.findAll({
			// 		 include:[{
			// 			 model : FacilitySurvey
			// 		 }],
			// 		 where : {
			// 			 category_id : id
			// 		 }
			// 	 })
			//  }));
			// let category = Category.findAll({
			// 	attributes: ['User.*', 'Post.*', [sequelize.fn('COUNT', 'Post.id'), 'PostCount']],
			// 	include: [{

			// 	}]
			//   })
			// whereCondition.category_id = {
			// 	[Op.in]: categoryIds
			// }

			// let facilityTypes = await FacilityType.findAll({
			// 	where : whereCondition
			// })
			// .catch(err => {
			// 	return res.send({
			// 		success: 0,
			// 		message: 'Something went wrong while getting facility types',
			// 	})
			// })
			let grade_summary = {};
			let gradewise_entity_counts = [];
			let survey_count = await Survey.count({
				where: {
					status: 1,
					is_active: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while counting surveys',
					})
				})


			grade_summary.total_entities = survey_count;
			grade_summary.gradewise_entity_counts = [];
			if (!params.grade) {
				let grades = await GradeConfiguaration.findAll({
					where: {
						status: 1,
					},
					attributes: ['id', 'grade'],
					order: [['grade', 'ASC']],

				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while fetching grade config',
						})
					});


				// let gradeArray = []
				// for(let i = 0; i < grades.length; i++){
				//   gradeArray.push(grades[i].grade);
				// }

				gradecondition.status = 1
				gradecondition.is_active = 1
				await Promise.all(grades.map(async (item) => {
					if (item.grade) {
						gradecondition.grade = item.grade
						let count = await Survey.count({
							// where: {
							// 	grade: item.grade,
							// 	status: 1,
							// 	is_active: 1

							// }
							where: gradecondition
						})
							.catch(err => {
								return res.send({
									success: 0,
									message: 'Something went wrong while fetching survey',
								})
							})
						let obj = {};
						obj.grade = item.grade;
						obj.count = count;
						gradewise_entity_counts.push(obj);
					}

				}));
				grade_summary.gradewise_entity_counts = gradewise_entity_counts;
			} else {
				gradecondition.status = 1;
				gradecondition.is_active = 1;
				gradecondition.grade = params.grade;
				let count = await Survey.count({
					where: gradecondition
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while fetching survey',
						})
					})
				let obj = {};
				obj.grade = params.grade;
				obj.count = count;
				gradewise_entity_counts.push(obj);
				grade_summary.gradewise_entity_counts = gradewise_entity_counts;

			}




			whereCondition.user_type = constants.TYPE_SECRATERY_SECTION_USER;
			let total_no_of_secretary_app_users = await User.count({
				where: whereCondition
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting count of secretary app users',
					})
				})
			whereCondition.user_type = constants.TYPE_DATA_COLLECTION_SECTION_USER;

			let total_no_of_data_collection_app_users = await User.count({
				where: whereCondition
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting count of secretary app users',
					})
				})
			let total_no_of_app_users = total_no_of_secretary_app_users + total_no_of_data_collection_app_users;


			let summary = [{
				label: 'Mobile App Users',
				value: total_no_of_app_users,
				icon: 'account_circle',
				link: '/allmobileusers'
			}, {
				label: 'Facility Data Collection Users',
				value: total_no_of_data_collection_app_users,
				icon: 'admin_panel_settings',
				link: '/mobileusers/data_collection_section_user'
			}, {
				label: 'Secretary App Users',
				value: total_no_of_secretary_app_users,
				icon: 'account_box',
				link: '/mobileusers/secratery_section_user'
			}, {
				label: 'Activated LSGIs',
				value: activated_lsgi_count,
				icon: 'assignment_ind',
				link: '/survey-results'
			}
			];

			let facility_summary = [];
			let x = [];
			let y = [];
			let facility_where_condition = {
				status: 1
			};
			if (params.facility_category_id) {
				facility_where_condition.id = params.facility_category_id;
			}


			/*var facility = await FacilityType.findAll({
				attributes: ['id','name_en' ,'name_ml', [Sequelize.fn('COUNT', Sequelize.col('facilityType.id')),'count'],],
				include: [
					{
						model: FacilitySurvey,
						attributes: [],
						// required: false,
						where: facility_where_condition
					}
				],
				group: 'facilityType.id',
				where : {
					status : 1
				}
			})*/


			delete facilitywhereCondition.lsgi_type_id;


			// 			var facility = await FacilitySurvey.findAll({
			// 	attributes: [[Sequelize.fn('COUNT', Sequelize.col('categoryRelatioship.id')), 'count']],
			// 				//attributes: [[Sequelize.fn('COUNT', Sequelize.col('facilityType.id')), 'count']],
			// 				include: [
			// 					{
			// 						model: CategoryRelationship,
			// 						attributes: ['parent_cat_id'],
			// 						// required: false,
			// 						where: { status: 1 },
			// 						include:[{
			// 							model:Category,
			// 							attributes:['id','name_en','name_ml'],
			// 							as:'parent_category',
			// 							where:{status:1}
			// 						}]
			// 					},{model:Lsgi,attributes:['lsgi_type_id'],where:lsgicon}
			// 					// {
			// 					// 	model: FacilityType,
			// 					// 	attributes: ['id', 'name_en', 'name_ml',],
			// 					// 	// required: false,
			// 					// 	where: { status: 1 }
			// 					// }
			// 				],
			// group: 'categoryRelatioship.id',
			// 				//group: 'facilityType.id',
			// 				where: facilitywhereCondition

			// 			});


			// 			facility = JSON.stringify(facility);
			// 			// console.log('logloglog');

			// 			// console.log(facility);
			// 			if (facility) {
			// 				facility = JSON.parse(facility);
			// 			}
			// 			let obj = {};

			// 			let responseArray = facility.map(function (item) {
			// 				console.log(item);
			// 				console.log("Count is " + item.count);
			// 				var ret = {
			// 					id: item.categoryRelatioship.parent_cat_id,
			// 					name_en: item.categoryRelatioship.parent_category.name_en,
			// 					name_ml: item.categoryRelatioship.parent_category.name_ml,
			// 					count: item.count
			// 				};
			// 				item = ret;

			// 				obj[item.id] = item.count;
			// 				console.log("Item is " + JSON.stringify(ret));
			// 				return ret;
			// 			});



			// let allFacilityCategories = await Category.findAll({
			// 			//let allFacilityTypes = await FacilityType.findAll({
			// 				where: facility_where_condition,

			// 				attributes: ['name_en', 'name_ml', 'id']
			// 			})

			// let allResponseArray = allFacilityCategories.map(function (item) { return item.toJSON() });
			// 			//let allResponseArray = allFacilityTypes.map(function (item) { return item.toJSON() });

			// 			for (let i = 0; i < allResponseArray.length; i++) {
			// 				let item = allResponseArray[i];
			// 				let id = item.id;
			// 				item.count = obj[id] ? obj[id] : 0;
			// 			}
			let totalResult = [];
			let organicResult = [];
			let inorganicResult = [];
			let liquidResult = [];
			let otherResult = [];

			let Liquid_count = 0;
			let Other_count = 0;
			let Organic_count = 0;
			let Inorganic_count = 0;


			//Organic
			let OrganicchildCategories = await getRecordsWithParentCatId(catId = 43, CategoryRelationship, Category)

			for (let i = 0; i < OrganicchildCategories.length; i++) {
				let count = 0;
				let item = OrganicchildCategories[i]
				let cat_name = item.child_category.name_en
				let cat_id = item.child_cat_id;
				let relationshipId = item.id;

				if (cat_id != null) {
					count = await calculateCount(cat_id, relationshipId, CategoryRelationship, FacilitySurvey, Lsgi, Sequelize, Category, facilitywhereCondition, lsgicon);
					console.log(count);
				}
				let obj = {
					id: cat_id,
					name_en: cat_name,
					//cat_relationship_id:relationshipId,
					count: count
				}
				Organic_count += count;


				organicResult.push(obj)
			}
			//InOrgnaic
			//catId=44

			let inOrgDat = await FacilityType.findAll({
				where: {
					status: 1,
					category_id: 44
				}
			}).catch(err => console.log(err));
			for (let i = 0; i < inOrgDat.length; i++) {
				let count = 0;
				let item = inOrgDat[i]
				let cat_name = item.name_en
				let cat_id = item.id;

				//count = await getCountForCategoryRelationshipIds([cat_id],FacilitySurvey,Lsgi,Sequelize,facilitywhereCondition,lsgicon);
				count = await getCountForFacilityTypeIds([cat_id], FacilitySurvey, Sequelize, typewhereCondition,);

				let obj = {
					id: cat_id,
					name_en: cat_name,
					count: count
				}
				Inorganic_count += count;

				inorganicResult.push(obj)
			}
			//Liquid
			let LiquidchildCategories = await getRecordsWithParentCatId(catId = 41, CategoryRelationship, Category)

			for (let i = 0; i < LiquidchildCategories.length; i++) {
				let count = 0;
				let item = LiquidchildCategories[i]
				let cat_name = item.child_category.name_en
				let cat_id = item.child_cat_id;
				let relationshipId = item.id;
				if (cat_id != null) {
					count = await calculateCount(cat_id, relationshipId, CategoryRelationship, FacilitySurvey, Lsgi, Sequelize, Category, facilitywhereCondition, lsgicon);
					console.log(count);
				}
				let obj = {
					id: cat_id,
					name_en: cat_name,
					//cat_relationship_id:relationshipId,
					count: count
				}
				Liquid_count += count;
				liquidResult.push(obj)
			}
			//Other
			let OtherchildCategories = await getRecordsWithParentCatId(catId = 42, CategoryRelationship, Category)

			for (let i = 0; i < OtherchildCategories.length; i++) {
				let count = 0;
				let item = OtherchildCategories[i]
				let cat_name = item.child_category.name_en
				let cat_id = item.child_cat_id;
				let relationshipId = item.id;

				if (cat_id != null) {
					count = await calculateCount(cat_id, relationshipId, CategoryRelationship, FacilitySurvey, Lsgi, Sequelize, Category, facilitywhereCondition, lsgicon);
					console.log(count);
				}
				let obj = {
					id: cat_id,
					name_en: cat_name,
					//cat_relationship_id:relationshipId,
					count: count
				}
				Other_count += count;

				otherResult.push(obj)
			}
			let Solid_count = Organic_count + Inorganic_count;

			//TotalSummary
			let dat = await CategoryRelationship.findAll({
				where: {
					status: 1,
					parent_cat_id: null
				}
			}).catch(err => console.log(err));
			// console.log('total dat ');
			// console.log(JSON.stringify(dat));


			for (let i = 0; i < dat.length; i++) {
				let objt = {};

				let catId = dat[i].child_cat_id;
				objt.id = catId;
				let catname = await Category.findOne({
					where: {
						status: 1,
						id: catId
					}
				}).catch(err => console.log(err));

				objt.name_en = catname.name_en;
				if (catId == 40) {
					objt.count = Solid_count;
				}
				if (catId == 41) {
					objt.count = Liquid_count;
				}
				if (catId == 42) {
					objt.count = Other_count;
				}

				totalResult.push(objt)

			}
			let responseObj = {
				// categorywise_survey_count,
				summary,
				grade_summary,
				total_summary: totalResult,
				organic_summary: organicResult,
				inorganic_summary: inorganicResult,
				liquid_summary: liquidResult,
				other_summary: otherResult

			}
			return res.send(responseObj);


		},

		this.getSurveyCountByCategory = async (req, res) => {
			let catId = req.query.cat_id;
			let catRelId = req.query.cat_relationship_id;
			//let result =await getEndrelationshipIds(catId,null,CategoryRelationship)
			var result = []
			if (catRelId) {
				result = await getCountForCategoryRelationshipIds([catRelId], FacilitySurvey, Sequelize);
				return res.send({ count: result })
			}
			let childCategories = await getRecordsWithParentCatId(catId, CategoryRelationship, Category)

			// await childCategories.map(async item=>{

			for (let i = 0; i < childCategories.length; i++) {
				let count = 0;
				item = childCategories[i]
				let cat_name = item.child_category.name_en
				let cat_id = item.child_cat_id;
				let relationshipId = item.id;
				if (cat_id != null)
					count = await calculateCount(cat_id, CategoryRelationship, FacilitySurvey, Lsgi, Sequelize, Category);
				console.log(count);

				let obj = {
					cat_id: cat_id,
					cat_relationship_id: relationshipId,
					cat_name: cat_name,
					count: count
				}
				result.push(obj)
			}
			res.send({ result: result })
		},

		this.getFacilitySurveyReport = async (req, res) => {
			let params = req.query;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			whereCondition.status = 1;
			let havingCondition = {};

			//date_from_to & lsgi type count functional or non functional
			// if (params.district_id) {
			// 	whereCondition.district_id = params.district_id
			// }
			// if (params.lsgi_block_id) {
			// 	whereCondition.lsgi_block_id = params.lsgi_block_id
			// }
			// if(params.count){
			// 	whereCondition.count = params.count
			// }
			if (params.ward_id) {
				whereCondition.ward_id = params.ward_id
			}
			if (params.lsgi_type_id) {
				whereCondition.lsgi_type_id = params.lsgi_type_id
			}
			if (params.lsgi_id) {
				whereCondition.lsgi_id = params.lsgi_id
			}
			// if (params.category_id) {
			// 	whereCondition.category_id = params.category_id
			// }
			let categoryCondition = {};

			categoryCondition.status = 1;

			if (params.category_id) {
				let child_cat_id = {
					[Op.like]: '%' + params.category_id + '%',
				}
				let parent_cat_id = {
					[Op.like]: '%' + params.category_id + '%',
				}
				categoryCondition = Sequelize.or({ child_cat_id }, { parent_cat_id });
			}
			if (params.surveyor_account_id) {
				whereCondition.surveyor_account_id = params.surveyor_account_id
			}
			if (params.lsgi_name) {
				let nameEnObj = {
					name_en: lsgi,
				};
				let nameMlObj = {
					name_ml: lsgi
				};
				let findCriteria = Sequelize.or(nameEnObj, nameMlObj)
				findCriteria.status = 1
				let lsgiData = await Lsgi.findOne({
					where: findCriteria
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while getting Lsgis',
						})
					})
				let lsgiId = lsgiData.id;
				whereCondition.lsgi_id = lsgiId;
			}
			if (params.start_count || params.end_count) {
				if (params.start_count && !params.end_count) {
					havingCondition.count = {
						[Op.gte]: params.start_count
					}
				}
				if (!params.start_count && params.end_count) {
					havingCondition.count = {
						[Op.lte]: params.end_count
					}
				}
				if (params.start_count && params.end_count) {
					havingCondition.count = {
						[Op.between]: [params.start_count, params.end_count]
					}
				}
			}
			let userDataz = req.identity.data;

			let lsgiCondition = {};
			lsgiCondition.status = 1;

			if (userDataz.district_id && userDataz.district_id != null) {
				lsgiCondition.district_id = userDataz.district_id;
			}
			if (userDataz.lsgi_id && userDataz.lsgi_id != null) {
				whereCondition.lsgi_id = userDataz.lsgi_id;
			}

			if (userDataz.ward_id && userDataz.ward_id != null) {
				whereCondition.ward_id = userDataz.ward_id;
			}

			if (params.start_date || params.end_date) {
				if (params.start_date && !params.end_date) {

					let startdate = params.start_date;
					console.log(startdate);
					chkNullDate(startdate, res);




					whereCondition.created_at = {
						[Op.gte]: startdate,
						[Op.lte]: new Date()
					}
				}
				if (!params.start_date && params.end_date) {
					let enddate = params.end_date;
					console.log(enddate);


					chkNullDate(enddate, res);


					whereCondition.created_at = {
						[Op.lte]: enddate
					}

				}
				if (params.start_date && params.end_date) {
					let startdate = params.start_date;
					let enddate = params.end_date;
					console.log(startdate);
					console.log(enddate);
					chkNullDate(startdate, res);

					chkNullDate(enddate, res);


					whereCondition.created_at = {
						[Op.between]: [startdate, enddate]
					}
				}
			}


			let wardCondition = {};
			wardCondition.status = 1;
			if (params.keyword) {
				lsgiCondition.name_en = {
					[Op.like]: '%' + params.keyword + '%',
				};
				wardCondition.name_en = {
					[Op.like]: '%' + params.keyword + '%'
				};

			}


			let facilitySurveys = await FacilitySurvey.findAll({
				attributes: ['id', 'created_at', 'is_operational', 'lsgi.name_en', 'lsgi.name_ml', 'ward.name_en', 'ward.name_ml', [Sequelize.fn('COUNT', Sequelize.col('facilitySurvey.id')), 'count']],
				having: havingCondition,
				order: [
					['modified_at', 'DESC']
				],
				include: [{
					model: Lsgi,
					where: lsgiCondition
				}, {
					model: Ward,
					where: wardCondition
				}, {
					model: User,
					attributes: ['id', 'name', 'middle_name', 'last_name', 'designation', 'email', 'gender', 'phone', 'user_type', 'lsgi_id', 'district_id', 'lsgi_type_id', 'lsgi_block_id', 'role_id']
				},
				{
					model: CategoryRelationship,
					attributes: ['id', 'parent_cat_id', 'child_cat_id'],
					where: categoryCondition,
					include: [{
						model: Category,
						as: 'parent_category',
						attributes: ['id', 'name_en', 'name_ml']
					},
					{
						model: Category,
						as: 'child_category',
						attributes: ['id', 'name_en', 'name_ml']
					}]
				}

				],
				offset: offset,
				where: whereCondition,
				limit: perPage,
				group: ['facilitySurvey.id']
			})
			// .catch(err => {
			// 	return res.send({
			// 		success: 0,
			// 		message: 'Something went wrong while fetching facility survey data',
			// 		error: err
			// 	})
			// });
			// let facilitySurveyCount = await FacilitySurvey.count({
			// 	where: whereCondition,
			// 	group: ['facility_type_id']

			// })
			// 	.catch(err => {
			// 		return res.send({
			// 			success: 0,
			// 			message: 'Something went wrong while fetching facility survey count data',
			// 			error: err
			// 		})
			// 	});
			let facilitySurveyCount = await FacilitySurvey.count({
				include: [{
					model: Lsgi,
					where: lsgiCondition
				}, {
					model: Ward
				}, {
					model: User,
					attributes: ['id', 'name', 'middle_name', 'last_name', 'designation', 'email', 'gender', 'phone', 'user_type', 'lsgi_id', 'district_id', 'lsgi_type_id', 'lsgi_block_id', 'role_id']
				},
				{
					model: CategoryRelationship,
					attributes: ['id', 'parent_cat_id', 'child_cat_id'],
					where: categoryCondition,
					include: [{
						model: Category,
						as: 'parent_category',
						attributes: ['id', 'name_en', 'name_ml']
					},
					{
						model: Category,
						as: 'child_category',
						attributes: ['id', 'name_en', 'name_ml']
					}]
				}

				],
				where: whereCondition
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching facility survey count data',
						error: err
					})
				});

			totalPages = facilitySurveyCount / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: facilitySurveys,
				total_items: facilitySurveyCount,
				has_next_page: hasNextPage,
				total_pages: totalPages,
				page,
				per_page: perPage,
				message: "Facility survey listed successfully",
				success: 1,
			}
			res.send(response);
		},



		this.getWardWiseSurveyCountReport = async (req, res) => {
			let params = req.query;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			whereCondition.status = 1;

			//date facility category id functional or non functional
			if (params.district_id) {
				whereCondition.district_id = params.district_id
			}
			if (params.lsgi_block_id) {
				whereCondition.lsgi_block_id = params.lsgi_block_id
			}
			if (params.ward_id) {
				whereCondition.ward_id = params.ward_id
			}
			if (params.lsgi_id) {
				whereCondition.lsgi_id = params.lsgi_id
			}
			if (params.is_operational) {
				whereCondition.is_operational = params.is_operational
			}
			// if(params.surveyor_account_id){
			// 	whereCondition.surveyor_account_id = params.surveyor_account_id
			// }
			if (params.category_id) {
				whereCondition.category_id = params.category_id
			}
			// if(params.count){
			// 	whereCondition.count = params.count
			// }
			if (params.lsgi_name) {
				let nameEnObj = {
					name_en: lsgi,
				};
				let nameMlObj = {
					name_ml: lsgi
				};
				let findCriteria = Sequelize.or(nameEnObj, nameMlObj)
				findCriteria.status = 1
				let lsgiData = await Lsgi.findOne({
					where: findCriteria

				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while getting Lsgis',
						})
					})
				let lsgiId = lsgiData.id;
				whereCondition.lsgi_id = lsgiId;
			}

			let userDataz = req.identity.data;
			let lsgiCondition = {};
			lsgiCondition.status = 1;
			if (userDataz.district_id && userDataz.district_id != null) {
				lsgiCondition.district_id = userDataz.district_id;
			}
			if (userDataz.lsgi_id && userDataz.lsgi_id != null) {
				whereCondition.lsgi_id = userDataz.lsgi_id;
			}
			// if(userDataz.lsgi_block_id && userDataz.lsgi_block_id!=null){
			// 	whereCondition.lsgi_block_id=userDataz.lsgi_block_id;
			// }
			if (userDataz.ward_id && userDataz.ward_id != null) {
				whereCondition.ward_id = userDataz.ward_id;
			}
			// if (params.start_count || params.end_count) {
			// 	whereCondition.count = {
			// 		[Op.gte]: params.start_count,
			// 		[Op.lte]: params.end_count
			// 	}
			// }
			let havingCondition = {}
			if (params.start_count || params.end_count) {
				if (params.start_count && !params.end_count) {
					havingCondition.count = {
						[Op.gte]: params.start_count
					}
				}
				if (!params.start_count && params.end_count) {
					havingCondition.count = {
						[Op.lte]: params.end_count
					}
				}
				if (params.start_count && params.end_count) {
					havingCondition.count = {
						[Op.between]: [params.start_count, params.end_count]
					}
				}
			}

			if (params.start_date || params.end_date) {
				if (params.start_date && !params.end_date) {

					let startdate = params.start_date;
					console.log(startdate);
					chkNullDate(startdate, res);




					whereCondition.created_at = {
						[Op.gte]: startdate,
						[Op.lte]: new Date()
					}
				}
				if (!params.start_date && params.end_date) {
					let enddate = params.end_date;
					console.log(enddate);


					chkNullDate(enddate, res);


					whereCondition.created_at = {
						[Op.lte]: enddate
					}

				}
				if (params.start_date && params.end_date) {
					let startdate = params.start_date;
					let enddate = params.end_date;
					console.log(startdate);
					console.log(enddate);
					chkNullDate(startdate, res);

					chkNullDate(enddate, res);


					whereCondition.created_at = {
						[Op.between]: [startdate, enddate]
					}
				}
			}
			let wardCondition = {};
			wardCondition.status = 1;
			if (params.keyword) {
				lsgiCondition.name_en = {
					[Op.like]: '%' + params.keyword + '%',
				};
				wardCondition.name_en = {
					[Op.like]: '%' + params.keyword + '%'
				};
			}
			let facilitySurveys = await FacilitySurvey.findAll({
				group: ['ward_id', 'ward.name_en'],
				attributes: ['ward.name_en', [Sequelize.fn('COUNT', Sequelize.col('facilitySurvey.id')), 'count']],
				// order: [
				// 	['modified_at', 'DESC']
				// ],
				having: havingCondition,
				include: [{
					model: Lsgi,
					where: lsgiCondition,
					attributes: []
				}, {
					model: Ward,
					attributes: ['name_en'],
					where: wardCondition
				}, {
					model: User,
					attributes: []
				}],
				offset: offset,

				where: whereCondition,

				limit: perPage,
				//raw: true
			})
			// .catch(err => {
			// 	return res.send({
			// 		success: 0,
			// 		message: 'Something went wrong while fetching facility survey data',
			// 		error: err
			// 	})
			// });
			let resData = []
			facilitySurveys = facilitySurveys ? JSON.stringify(facilitySurveys) : null;
			facilitySurveys = facilitySurveys ? JSON.parse(facilitySurveys) : null;
			for (let i = 0; i < facilitySurveys.length; i++) {

				let obj = {};
				let item = facilitySurveys[i];
				console.log(item);

				let ward = item.ward.name_en;
				let count = item.count;
				obj.ward = ward;
				obj.count = count;
				resData.push(obj);
			}
			let facilitySurveyCount = await FacilitySurvey.count({
				include: [{
					model: Lsgi,
					where: lsgiCondition,
					attributes: []
				}, {
					model: Ward,
					attributes: [],
					where: wardCondition
				}, {
					model: User,
					attributes: []
				}],
				having: havingCondition,
				where: whereCondition
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching facility survey count data',
						error: err
					})
				});

			totalPages = facilitySurveyCount / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: resData,
				total_items: facilitySurveyCount,
				has_next_page: hasNextPage,
				total_pages: totalPages,
				page,
				per_page: perPage,
				message: "Ward wise Facility survey listed successfully",
				success: 1,
			}
			res.send(response);
		},

		this.getGradeWiseReport = async (req, res) => {
			let params = req.query;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			let lsgiCondition = {}

			if (params.district_id) {
				whereCondition.district_id = params.district_id
			}
			if (params.grade) {
				whereCondition.grade = params.grade
			}


			if (params.lsgi_type_id) {
				whereCondition.lsgi_type_id = params.lsgi_type_id
			}

			if (params.lsgi_id) {
				whereCondition.lsgi_id = params.lsgi_id
			}
			if (params.lsgi_block_id) {
				whereCondition.lsgi_block_id = params.lsgi_block_id
			}
			if (params.start_point || params.end_point) {
				if (params.start_point && !params.end_point) {
					whereCondition.points = {
						[Op.gte]: params.start_point
					}
				}
				if (!params.start_point && params.end_point) {
					whereCondition.points = {
						[Op.lte]: params.end_point
					}
				}
				if (params.start_point && params.end_point) {
					whereCondition.points = {
						[Op.between]: [params.start_point, params.end_point]
					}
				}
			}
			if (params.lsgi_type_id) {
				whereCondition.lsgi_type_id = params.lsgi_type_id
			}
			if (params.name) {
				lsgiCondition.name_en = {
					[Op.like]: '%' + params.name + '%',
				};
			}
			if (params.lsgi_type_id) {
				whereCondition.lsgi_type_id = params.lsgi_type_id
			}


			if (params.start_date || params.end_date) {
				if (params.start_date && !params.end_date) {

					let startdate = params.start_date;
					console.log(startdate);

					chkNullDate(startdate, res);


					whereCondition.created_at = {
						[Op.gte]: startdate,
						[Op.lte]: new Date()
					}
				}
				if (!params.start_date && params.end_date) {
					let enddate = params.end_date;
					console.log(enddate);
					chkNullDate(enddate, res);


					whereCondition.created_at = {
						[Op.lte]: enddate
					}

				}
				if (params.start_date && params.end_date) {
					let startdate = params.start_date;
					let enddate = params.end_date;
					console.log(startdate);
					console.log(enddate);
					chkNullDate(startdate, res);

					chkNullDate(enddate, res);


					whereCondition.created_at = {
						[Op.between]: [startdate, enddate]
					}
				}
			}

			let userDataz = req.identity.data;
			if (userDataz.district_id && userDataz.district_id != null) {
				whereCondition.district_id = userDataz.district_id;
			}
			if (userDataz.lsgi_id && userDataz.lsgi_id != null) {
				whereCondition.lsgi_id = userDataz.lsgi_id;
			}
			if (userDataz.lsgi_block_id && userDataz.lsgi_block_id != null) {
				whereCondition.lsgi_block_id = userDataz.lsgi_block_id;
			}
			// if(userDataz.ward_id && userDataz.ward_id!=null){
			// 	whereCondition.ward_id=userDataz.ward_id;
			// }

			lsgiCondition.status = 1;
			let typeCondition = {}
			typeCondition.status = 1;
			if (params.keyword) {
				lsgiCondition.name_en = {
					[Op.like]: '%' + params.keyword + '%',
				};
				typeCondition.name_en = {
					[Op.like]: '%' + params.keyword + '%'
				};

			}

			let gradeWiseReport = await Survey.findAll({
				attributes: ['id', 'lsgi.name_en', 'lsgi.name_ml', 'lsgiType.name_en', 'lsgiType.name_ml', 'grade', ['points', 'marks'], 'created_at'],

				order: [
					['modified_at', 'DESC']
				],
				include: [{
					model: Lsgi,
					where: lsgiCondition
				}, {
					model: LsgiType,
					where: typeCondition
				}],
				offset: offset,
				where: whereCondition,
				limit: perPage,
			})
			// .catch(err => {
			// 	return res.send({
			// 		success: 0,
			// 		message: 'Something went wrong while fetching facility survey data',
			// 		error: err
			// 	})
			// });
			let GradeWiseReportCount = await Survey.count({
				where: whereCondition
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching Grade_Wise Report count data',
						error: err
					})
				});

			totalPages = GradeWiseReportCount / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: gradeWiseReport,
				total_items: GradeWiseReportCount,
				has_next_page: hasNextPage,
				total_pages: totalPages,
				page,
				per_page: perPage,
				message: "Grade Wise Report listed successfully",
				success: 1,
			}
			res.send(response);

		},

		// Label- CRUD 

		this.createLabels = async (req, res) => {
			let params = req.body;

			if (!params.value_ml || !params.value_en || !params.key_text) {
				var errors = [];

				if (!params.value_ml) {
					errors.push({
						field: "value_ml",
						message: 'Require Labels Malayalam value'

					});
				}
				if (!params.value_en) {
					errors.push({
						field: "value_en",
						message: 'Require Labels English value'
					});
				}
				if (!params.key_text) {
					errors.push({
						field: "key_text",
						message: 'Require key_text for label'
					});
				}
				return res.send({
					success: 0,
					statusCode: 400,
					errors: errors,
				});
			};


			let labelObj = {
				value_ml: params.value_ml.trim(),
				value_en: params.value_en.trim(),
				key_text: params.key_text.trim(),
				status: 1
			}
			let valueMlCheck = await Label.findOne({
				where: {
					value_ml: params.value_ml.trim(),
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking malayalam labels value exists or not',
						error: err
					})
				})
			if (valueMlCheck) {
				return res.send({
					success: 0,
					message: 'Labels malayalam value already exists..'
				})
			}

			let valueEnCheck = await Label.findOne({
				where: {
					value_en: params.value_en.trim(),
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking english labels value exists or not',
						error: err
					})
				})
			if (valueEnCheck) {
				return res.send({
					success: 0,
					message: 'Labels english value already exists..'
				})
			}
			let key_textCheck = await Label.findOne({
				where: {
					key_text: params.key_text.trim(),
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking key_text labels value exists or not',
						error: err
					})
				})
			if (key_textCheck) {
				return res.send({
					success: 0,
					message: 'Labels key_text value already exists..'
				})
			}


			try {
				let data = await Label.create(labelObj);

				res.status(200).send({
					success: 1,
					id: data.dataValues.id,
					message: "Label created successfully."
				});
			} catch (err) {
				console.log(err);
				return res.send({
					success: 0,
					message: 'Error while create a label'
				})
			}
		},
		this.updateLabels = async (req, res) => {
			let labelId = req.params.id;
			let update = {};
			update.modified_at = new Date();
			update.status = 1;
			if (!req.body.value_ml && !req.body.value_en && !req.body.key_text) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}
			if (req.body.value_ml) {
				update.value_ml = req.body.value_ml.trim();
			}
			if (req.body.value_en) {
				update.value_en = req.body.value_en.trim();
			}
			if (req.body.key_text) {
				update.key_text = req.body.key_text.trim();
			}
			let idData = await Label.findOne({
				where: {
					id: labelId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking labels id exists or not',
						error: err
					})
				})
			if (!idData) {
				return res.send({
					success: 0,
					message: 'Invalid label '
				})
			} else {
				if (req.body.value_en) {
					let labelData = await Label.findOne({
						where: {
							value_en: req.body.value_en.trim(),
							status: 1,
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking English Labels value already exists or not',
								error: err
							})
						})
					if (labelData && (labelData.id !== labelId)) {
						return res.send({
							success: 0,
							message: 'Labels English value already exists '
						})
					}
				}

				if (req.body.value_ml) {
					let labelData = await Label.findOne({
						where: {
							value_ml: req.body.value_ml.trim(),
							status: 1,
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking malayalam label value already exists or not',
								error: err
							})
						})
					if (labelData && (labelData.id !== labelId)) {
						return res.send({
							success: 0,
							message: 'Label Malayalam value already exists '
						})
					}
				}
				if (req.body.key_text) {
					let labelData = await Label.findOne({
						where: {
							key_text: req.body.key_text.trim(),
							status: 1,
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking key_text label already exists or not',
								error: err
							})
						})
					if (labelData && (labelData.id !== labelId)) {
						return res.send({
							success: 0,
							message: 'Label key_text value already exists '
						})
					}
				}

				await Label.update(update, {
					where: {
						id: labelId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating label value',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Label values updated successfully."
				});
			}


		},
		this.listLabels = async (req, res) => {
			let params = req.query;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			if (params.value) {
				let value_en = {
					[Op.like]: '%' + params.value + '%',
				};
				let value_ml = {
					[Op.like]: '%' + params.value + '%'
				};
				whereCondition = Sequelize.or({ value_en }, { value_ml })
			}
			if (params.keyword) {
				let value_en = {
					[Op.like]: '%' + params.keyword + '%',
				};
				let value_ml = {
					[Op.like]: '%' + params.keyword + '%'
				};
				let key_text = {
					[Op.like]: '%' + params.keyword + '%'
				};
				whereCondition = Sequelize.or({ value_en }, { value_ml }, { key_text })
			}
			if (params.key_text) {
				whereCondition.key_text = params.key_text;
			}
			whereCondition.status = 1;

			var labels = await Label.findAll({
				order: [
					['modified_at', 'DESC']
				],
				offset: offset,
				where: whereCondition,

				limit: perPage,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching labels data',
						error: err
					})
				});

			var count = await Label.count({
				where: whereCondition,

			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching labels count data',
						error: err
					})
				});

			totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: labels,
				total_items: count,
				total_pages: totalPages,
				page,
				per_page: perPage,
				has_next_page: hasNextPage,
				message: "Labels listed successfully",
				success: 1,
			}
			return res.send(response);
		},


		this.getLabels = async (req, res) => {
			let labelId = req.params.id;
			let labelData = await Label.findOne({
				where: {
					id: labelId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting labels data',
						error: err
					})
				})
			let response = {
				labels: labelData,
				success: 1,
			}
			return res.send(response);
		},
		this.deleteLabels = async (req, res) => {
			let labelId = req.params.id;
			let labelData = await Label.findOne({
				where: {
					id: labelId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting labels data',
						error: err
					})
				})
			if (labelData) {
				let update = {
					status: 0
				}
				await Label.update(update, {
					where: {
						id: labelData.id

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while deleting labels',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Labels deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "Labels not exists."
				});
			}


		}
		,
		this.getprofileUpdate = async (req, res) => {
			let userId = req.identity.data.id;
			let idData = await User.findOne({
				where: {
					status: 1,
					id: userId
				}
			}).catch(err => {
				return res.send({
					success: 0,
					message: 'Something went wrong while checking user id ',
					error: err
				})
			})
			let response = {
				user: idData,
				success: 1,
			}
			return res.send(response);
		},
		// updateUser
		this.profileUpdate = async (req, res) => {
			let userId = req.identity.data.id;
			let update = {};
			let params = req.body;
			update.modified_at = new Date();
			update.status = 1;
			if (!params.name && !params.gender && !params.district_id &&
				!params.middle_name && !params.lsgi_block_id && !params.last_name &&
				!params.email && !params.phone && !params.designation && !params.lsgi_type_id &&
				!params.lsgi_id) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}
			if (params.name) {
				update.name = params.name;
			}
			if (params.gender) {
				update.gender = params.gender;
			}
			if (params.district_id) {
				update.district_id = params.district_id;
			}
			if (params.middle_name) {
				update.middle_name = params.middle_name;
			}
			if (params.lsgi_block_id) {
				update.lsgi_block_id = params.lsgi_block_id;
			}
			if (params.last_name) {
				update.last_name = params.last_name;
			}
			if (params.email) {
				update.email = params.email;
			}
			if (params.phone) {
				update.phone = params.phone;
			}
			if (params.designation) {
				update.designation = params.designation;
			}
			if (params.lsgi_id) {
				update.lsgi_id = params.lsgi_id;
			}
			if (params.lsgi_type_id) {
				update.lsgi_type_id = params.lsgi_type_id;
			}

			let idData = await User.findOne({
				where: {
					status: 1,
					id: userId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking user id exists or not',
						error: err
					})
				})
			if (!idData) {
				return res.send({
					success: 0,
					message: 'Invalid user '
				})
			} else {
				if (params.email) {
					let emailData = await User.findOne({
						where: {
							email: params.email,
							status: 1,
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking email already exists or not',
								error: err
							})
						})
					if (emailData && (emailData.id !== userId)) {
						return res.send({
							success: 0,
							field: 'email',
							message: 'Email already exists '
						})
					}
				}

				if (params.phone) {
					let phoneData = await User.findOne({
						where: {
							email: params.phone,
							status: 1,
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking phone already exists or not',
								error: err
							})
						})
					if (phoneData && (phoneData.id !== userId)) {
						return res.send({
							success: 0,
							field: 'phone',
							message: 'Phone already exists '
						})
					}
				}


				await User.update(update, {
					where: {
						id: userId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating user',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "User updated successfully."
				});
			}


		}
		, this.profilePassword = async (req, res) => {
			let params = req.body;
			var userData1 = req.identity;
			var userId = userData1.data.id;

			if (!params.new_password || !params.current_password) {
				var errors = [];

				if (!params.new_password) {
					errors.push({
						field: "new_password",
						message: "Require new password"
					});
				}
				if (!params.current_password) {
					errors.push({
						field: "current_password",
						message: "Require current password"
					});
				}


				return res.send({
					success: 0,
					statusCode: 400,
					errors: errors,
				});
			};
			let userData = await User.findOne({
				where: {
					id: userId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking user id exists or not',
						error: err
					})
				})
			// if (!userData || userData === null || (userData.user_type === constants.Type_ADMIN)) {
			if (!userData || userData === null) {
				return res.send({
					success: 0,
					message: 'Invalid user '
				})
			}
			let matched = await bcrypt.compare(params.current_password, userData.password);
			if (matched) {
				const hash = bcrypt.hashSync(params.new_password, salt);

				let update = {
					password: hash,
					modified_at: new Date()
				}
				await User.update(update, {
					where: {
						id: userId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating user password',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Password updated successfully."
				});
			} else {
				return res.send({
					success: 0,
					message: 'Invalid current password '
				})
			}


		},
			this.createNotificationHistory = async (req, res) => {
				// const pushClient = new Onesignal.Client(onesignalConfig.appId,onesignalConfig.apiKey);
				let params = req.body;
                let userData = req.identity;
                let userId = userData.data.id;
				let notification_id = params.notification_id;
				if (!params.notification_id || !params.user_type) {
					let errors = [];
					if (!params.notification_id) {
						errors.push({
							field: "notification id",
							message: 'Require notification id'

						});
					}

                    if (!params.user_type) {
                        errors.push({
                            field: "user_type",
                            message: 'Require user type'
                        })
                    }
					return res.send({
						success: 0,
						statusCode: 400,
						errors: errors,
					});
				};
				let notifData = await Notification.findOne({
					where: {
						id: notification_id,
						status: 1
					}
				}).catch(err => {
					return {
						success: 0,
						message: 'Something went wrong while getting notif data',
						error: err
					}
				})
				let whereCondition = {}
				whereCondition.status=1;
				whereCondition.user_type= params.user_type.trim();
				
				if (params.district_id){
					whereCondition.district_id=params.district_id;
				}
				if (params.lsgi_type_id){
					whereCondition.lsgi_type_id=params.lsgi_type_id;
				}
				if (params.lsgi_id){
					whereCondition.lsgi_id=params.lsgi_id;
				}
				if (params.lsgi_block_id){
					whereCondition.lsgi_block_id=params.lsgi_block_id;
				}

				let userTypes = await User.findAll({
					where: whereCondition 
				}).catch(err => {
					return {
						success: 0,
						message: 'Something went wrong while getting user type data',
						error: err
					}
				})

				let playerId=[];

				let notificationHistorys=[];

				for(let i=0;i<userTypes.length;i++) {
					
					let item=userTypes[i];
					let userTypes_id=item.id;
					let lsgi_type_id=item.lsgi_type_id;
					let lsgi_id=item.lsgi_id;
					let lsgi_block_id= item.lsgi_block_id;
					let district_id = item.district_id;
					let player_id = item.player_id;
				  if(player_id != null ){
					playerId.push(player_id)
					
					let notificationHistory={
						notification_id: params.notification_id,
						user_id: userId,
						recipient_id:userTypes_id,
						lsgi_type_id: lsgi_type_id,
						lsgi_id: lsgi_id,
						lsgi_block_id: lsgi_block_id,
						district_id: district_id,
						read_status: 0,
						status: 1
					}
					notificationHistorys.push(notificationHistory)
				  }
				}
				console.log("notificationHistory********"+JSON.stringify(notificationHistorys));
				console.log("player ID**************"+JSON.stringify(playerId));
				
				// using async/await
				console.log("came inside");
				var message = {
					app_id: onesignalConfig.appId,
					title  :    {'en': notifData.title},
					contents:    {'en':notifData.content},
					// included_segments: ['updates'],
					include_player_ids: playerId
				};

				var headers = {
					"Content-Type": "application/json; charset=utf-8",
					"Authorization" : "Basic "+onesignalConfig.apiKey
				};
		
				var options = {
					host: "onesignal.com",
					port:443,
					path: "/api/v1/notifications",
					method: "POST",
					headers: headers,
					body: message,
					uri: "https://onesignal.com/api/v1/notifications",
					json: true,
					retry : 5, // will retry the call twice, in case of error.
					verbose_logging : false, // will log errors only, if set to be true, will log all actions
					accepted: [ 400, 404 ], // Accepted HTTP Status codes (will not retry if request response has any of these HTTP Status Code)
					delay: 2000, // will delay retries by 2000 ms.  The default is 100. 
					factor: 2 // will multiple the delay by the factor each time a retry is attempted. 
				};
				rp(options)
						.then(async function (parsedBody) {
							// POST succeeded...
							console.log("Post Succeeded");
							console.log(parsedBody);
							await NotificationHistory.bulkCreate(notificationHistorys);
							console.log("data inserted. sending response back to ui...")
							return res.send ({
								success:1,
								parsedBody : parsedBody,	
							})
						})
						.catch(function (err) {
							// POST failed...
							// console.log(err);
							return res.send ({
								success:0,
								error: err.name +" "+ err.message
							})
						});
			},

			this.listsidebarPermission = async (req, res) => {
				let params = req.query;
				let sidebarId = req.params.id;
				let userData = req.identity.data;
				let user_type = userData.user_type;
				let userId = userData.id;
				let page = params.page || 1;
				let perPage = Number(params.per_page) || 10;
				perPage = perPage > 0 ? perPage : 10;
				var offset = (page - 1) * perPage;
				let whereCondition = {};
				if (params.name) {
					whereCondition.name = {
						[Op.like]: '%' + params.name + '%',
					};
	
				}
				whereCondition.status = 1;
				let authRolePermissionCondition = {};
				authRolePermissionCondition.status = 1;
				authRolePermissionCondition.sidebar_menu_id = sidebarId;
				let sidemenu = await SidebarMenu.findOne({
					where: {
						id: sidebarId,
						status: 1
					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while fetching sidebarmanu data',
							error: err
						})
					});
				if (!sidemenu) {
					return res.send({
						success: 0,
						statusCode: e.statusCode,
						body: e.body
					})
				}
			},
		this.listsidebarPermission = async (req, res) => {
			let params = req.query;
			let sidebarId = req.params.id;
			let userData = req.identity.data;
			let user_type = userData.user_type;
			let userId = userData.id;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			if (params.name) {
				whereCondition.name = {
					[Op.like]: '%' + params.name + '%',
				};

			}
			whereCondition.status = 1;
			let authRolePermissionCondition = {};
			authRolePermissionCondition.status = 1;
			authRolePermissionCondition.sidebar_menu_id = sidebarId;
			let sidemenu = await SidebarMenu.findOne({
				where: {
					id: sidebarId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching sidebarmanu data',
						error: err
					})
				});
			if (!sidemenu) {
				return res.send({
					success: 0,
					message: 'Invalid Sidebar',
				})
			}
			var authPermissionSidebarMenu = await AuthPermissionSidebarMenu.findAll({
				order: [
					['modified_at', 'DESC']
				],
				// offset: offset,
				where: authRolePermissionCondition,
				// limit: perPage,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching authController data',
						error: err
					})
				});

			var authControllerPermissions = await AuthController.findAll({
				order: [
					['modified_at', 'DESC']
				],
				// offset: offset,
				where: whereCondition,
				include: [{
					model: AuthPermission,
					as: 'permissions'
				}],

				// limit: perPage,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching authController data',
						error: err
					})
				});
			let authPermissionIdArray = [];
			let authPermissionSidebarObj = {};
			var itm;
			var pid;
			for (let i = 0; i < authPermissionSidebarMenu.length; i++) {
				itm = authPermissionSidebarMenu[i];
				pid = itm.auth_permission_id;
				authPermissionIdArray.push(authPermissionSidebarMenu[i].auth_permission_id);
				authPermissionSidebarObj[pid] = true;
			}
			var j = 0;

			let responseArray = authControllerPermissions.map(function (item) { return item.toJSON() });
			console.log("Permissions obj: ");
			console.log(JSON.stringify(authPermissionSidebarObj));
			for (let j = 0; j < responseArray.length; j++) {
				let controller = responseArray[j];
				let k = 0;
				for (let k = 0; k < controller.permissions.length; k++) {
					let obj = controller.permissions[k];
					//console.log("User type is " + user_type);
					pid = controller.permissions[k].id;
					console.log("Checking permission  " + pid + " in permissions obj");
					obj['is_allowed'] = authPermissionSidebarObj[pid] ? true : false;

					responseArray[j].permissions[k] = obj;
				}
			}


			let response = {
				controllers: responseArray,
				name: sidemenu.name,
				message: "AuthPermissionSidebarMenu listed successfully",
				success: 1,
			}
			return res.send(response);
		},
		this.updateSidebarPermission = async (req, res) => {
			let params = req.body;
			let sidebarId = req.params.id;

			console.log("Params received are ");
			console.log(JSON.stringify(params));

			let update = {};
			update.modified_at = new Date();
			update.status = 1;
			if (!params.name && !params.permissions) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				});
			}
			if (params.name) {
				update.name = params.name.trim();
				let authCheckData = await SidebarMenu.findOne({
					where: {
						name: params.name,
						id: { $not: sidebarId }
					}
				}).catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting sidebarMenu permission',
						error: err
					});
				});
				if (authCheckData && (authCheckData.id !== sidebarId)) {
					return res.send({
						success: 0,
						message: 'Sidebarmenu name already exists '
					});
				}
				let sidebarmenuUpdate = await SidebarMenu.update(update, {
					where: {
						id: sidebarId
					}
				}).catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while updating sidebar menu name',
						error: err
					});
				});
			}
			if (params.permissions) {
				console.log("Permissions received..");
				await Promise.all(params.permissions.map(async (item) => {
					console.log("Processing " + JSON.stringify(item));
					if (item.id && item.is_allowed !== undefined) {
						console.log("Received permission entry is valid");
						let whereCondition = {
							sidebar_menu_id: sidebarId,
							auth_permission_id: item.id,
							status: 1
						};
						let sidebarData = await AuthPermissionSidebarMenu.findOne({
							where: whereCondition
						}).catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while updating sidebarmenu permission',
								error: err
							});
						});

						if (sidebarData) {
							console.log("Permission already exists in db...");
							if (!item.is_allowed) {
								console.log("Updating status to 0 in db...");
								await AuthPermissionSidebarMenu.update({
									status: 0
								}, {
									where: {
										id: sidebarData.id
									}
								}).catch(err => {
									return res.send({
										success: 0,
										message: 'Something went wrong while updating sidebarmenu permission',
										error: err
									})
								});
							}

						} else {
							console.log("Permission does not exist in db...");
							if (item.is_allowed) {
								console.log("Request is to allow permission");
								let sidebarPermissionObj = {
									sidebar_menu_id: sidebarId,
									auth_permission_id: item.id,
									status: 1
								}
								let data = await AuthPermissionSidebarMenu.create(sidebarPermissionObj)
									.catch(err => {
										return res.send({
											success: 0,
											message: 'Something went wrong while create an sidebarmenu permission',
											error: err
										});
									});
								console.log("Permission entered in db...");
							}
						}
					}

				}));
			}

			return res.status(200).send({
				success: 1,
				message: "AuthRole updated successfully."
			});
		},



		this.createFacilitySurveyQuestionGroup = async (req, res) => {
			let params = req.body;

			if (!params.name) {
				var errors = [];

				if (!params.name) {
					errors.push({
						field: "name",
						message: 'Require name'

					});
				}

				return res.send({
					success: 0,
					statusCode: 400,
					errors: errors,
				});
			};


			let questionGroupObj = {
				name: params.name.trim(),
				status: 1
			}
			let nameCheck = await QuestionGroup.findOne({
				where: {
					name: params.name.trim(),
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking QuestionGroup name exists or not',
						error: err
					})
				})
			if (nameCheck) {
				return res.send({
					success: 0,
					message: 'QuestionGroup name already exists..'
				})
			}


			try {
				let data = await QuestionGroup.create(questionGroupObj);

				res.status(200).send({
					success: 1,
					id: data.dataValues.id,
					message: "QuestionGroup created successfully."
				});
			} catch (err) {
				console.log(err);
				return res.send({
					success: 0,
					message: 'Error while create a QuestionGroup'
				})
			}
		},
		this.updateFacilitySurveyQuestionGroup = async (req, res) => {
			let groupId = req.params.id;
			let update = {};
			update.modified_at = new Date();
			update.status = 1;
			if (!req.body.name) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}
			if (req.body.name) {
				update.name = req.body.name.trim();
			}

			let idData = await QuestionGroup.findOne({
				where: {
					id: groupId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking auth group id exists or not',
						error: err
					})
				})
			if (!idData) {
				return res.send({
					success: 0,
					message: 'Invalid Group Id'
				})
			} else {
				if (req.body.name) {
					let questionGroupData = await QuestionGroup.findOne({
						where: {
							name: req.body.name.trim(),
							status: 1,
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while checking Group name already exists or not',
								error: err
							})
						})
					if (questionGroupData && (questionGroupData.id !== groupId)) {
						return res.send({
							success: 0,
							message: 'Group name already exists '
						})
					}
				}



				await QuestionGroup.update(update, {
					where: {
						id: groupId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating QuestionGroup name',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "QuestionGroup name updated successfully."
				});
			}


		},



		this.listFacilitySurveyQuestionGroup = async (req, res) => {
			let params = req.query;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			if (params.name) {
				whereCondition.name = {
					[Op.like]: '%' + params.name + '%',
				};

			}
			if (params.keyword) {
				whereCondition.name = {
					[Op.like]: '%' + params.keyword + '%',
				};

			}
			whereCondition.status = 1;

			var questionGroup = await QuestionGroup.findAll({
				order: [
					['modified_at', 'DESC']
				],
				offset: offset,
				where: whereCondition,

				limit: perPage,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching QuestionGroup data',
						error: err
					})
				});

			var count = await QuestionGroup.count({
				where: whereCondition,

			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching QuestionGroups count data',
						error: err
					})
				});

			totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: questionGroup,
				total_items: count,
				has_next_page: hasNextPage,
				total_Pages: totalPages,
				page,
				per_page: perPage,
				message: "QuestionGroups listed successfully",
				success: 1,
			}
			return res.send(response);
		},


		this.getFacilitySurveyQuestionGroup = async (req, res) => {
			let groupId = req.params.id;
			let questionGroupData = await QuestionGroup.findOne({
				where: {
					id: groupId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting questionGroup data',
						error: err
					})
				})
			let response = {
				questionGroup: questionGroupData,
				success: 1,
			}
			return res.send(response);
		},
		this.deleteFacilitySurveyQuestionGroup = async (req, res) => {
			let groupId = req.params.id;
			let questionGroupData = await QuestionGroup.findOne({
				where: {
					id: groupId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting questionGroup data',
						error: err
					})
				})
			if (questionGroupData) {
				let update = {
					status: 0
				}
				await QuestionGroup.update(update, {
					where: {
						id: groupId

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while deleting questionGroup',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "questionGroup deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "questionGroup not exists."
				});
			}


		},

		this.sendOtp = async (req, res) => {

			const uuidv4 = require('uuid/v4');

			var params = req.body;
			if (!params.phone) {
				return res.send({
					success: 0,
					message: 'Phone number cannot be empty'
				})
			}


			//	let userTypeCheck = Sequelize.or( constants.TYPE_SECRATERY_SECTION_USER ,  constants.TYPE_DATA_COLLECTION_SECTION_USER )

			let result = await User.findOne({
				where: {
					phone: params.phone,
					// user_type: constants.TYPE_USER,
					//	user_type: userTypeCheck,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while updating user password',
						error: err
					})
				})
			if (!result) {
				return res.send({
					success: 0,
					message: 'Please enter a registered phone number'
				})
			}
			var otp = Math.floor(1000 + Math.random() * 9000);
			const expiry = Date.now() + (otpConfig.expirySeconds * 1000);
			const apiToken = uuidv4();
			// msg91.send(params.phone, `${otp} is the OTP to reset password. Your OTP will expire in 2 minutes. Do not share this OTP with anyone.`, function (err, response) {
			//   if (response) {

			let otpData = await Otp.create({
				phone: params.phone,
				is_used: 0,
				otp: otp,
				api_token: apiToken,
				expiry: expiry
			})
			// .catch(err => {
			//   return res.send({
			//     success: 0,
			//     message: 'Something went wrong while create otp',
			//     error: err
			//   })
			// })
			var mobileNo = params.phone;
			console.log(mobileNo);
			msg91.send(mobileNo, `Your OTP  ## ${otp} ## for Suchitwa-Mission valid for 1 hour. Do not share this OTP with anyone`, function (err, response) {
				if (err) {
					console.log('Error :' + err);
				}
				console.log('Response : ' + response);
			});


			var responseObject = {
				success: 1,
				//phone: result.phone,
				//otp: otp,
				token: apiToken
			};
			return res.send(responseObject);

			// }
			// else {
			//   return res.send({
			//     success: 0,
			//     message: 'Some error occured. Couldnot send sms',
			//     error: err
			//   })
			// }
			// })


		},

		this.validateOtp = async (req, res) => {
			var params = req.body;
			var otp = params.otp;
			var token = params.token;
			var currentTime = Date.now();
			if (!otp || !token) {
				var errors = [];
				if (!otp) {
					errors.push({
						field: "otp",
						message: "otp is missing"
					});
				}
				if (!token) {
					errors.push({
						field: "token",
						message: "Token is missing"
					});
				}
				return res.status(200).send({
					success: 0,
					errors: errors,
					code: 200
				});
			}
			let result = await Otp.findOne({
				where: {
					otp: params.otp,
					api_token: token,
					is_used: 0
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting otp',
						error: err
					})
				})
			if (result) {
				if (parseInt(currentTime) > parseInt(result.expiry)) {
					return res.send({
						success: 0,
						message: 'otp expired,please resend otp to get a new one'
					})
				} else {
					var update = {
						is_used: 1
					}
					let data = await Otp.update(update, {
						where: {
							otp: params.otp,
							api_token: token
						}
					})
						.catch(err => {
							return res.send({
								success: 0,
								message: 'Something went wrong while updating otp',
								error: err
							})
						})
					let phone = result.phone;

					let userData = await User.findOne({
						where: {
							phone: phone,
							status: 1
						},
						include: [{
							model: Lsgi,
							as: "lsgi",
							attributesArray: ['name_en', 'id']
						}, {
							model: District,
							as: 'district',
							attributesArray: ['name_en', 'id']

						}]

					});

					var payload = {
						id: userData.id,
						name: userData.name,
						email: userData.email,
						phone: userData.phone,
						user_type: userData.user_type,
					};

					if (userData.district_id && userData.district_id != null) {
						payload.district_id = userData.district_id;
					}
					if (userData.lsgi_id && userData.lsgi_id != null) {
						payload.lsgi_id = userData.lsgi_id;
					}
					if (userData.lsgi_block_id && userData.lsgi_block_id != null) {
						payload.lsgi_block_id = userData.lsgi_block_id;
					}

					var Accesstoken = jwt.sign({
						data: payload,
					}, JWT_KEY, {
						expiresIn: '10h'
					});

					return res.send({
						success: 1,
						token: Accesstoken,
						message: 'Otp verified successfully'
					})

				}

			} else {
				return res.send({
					success: 0,
					message: 'Otp does not matching'
				})
			}
		},

		this.resetPassword = async (req, res) => {

			var userData = req.identity;
			var userId = userData.data.id;

			//var password;
			var params = req.body;
			//	var currentPassword = params.current_password;
			var newPassword = params.password;
			let result = await User.findOne({
				where: {
					id: userId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting user',
						error: err
					})
				});
			//password = result.password;
			//let isMatched = await bcrypt.compare(currentPassword, password);
			//if (isMatched) {
			var encrypted = bcrypt.hashSync(newPassword, salt);
			var update = {
				password: encrypted
			}
			let userUpdate = await User.update(update, {
				where: {
					id: userId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while reset password',
						error: err
					})
				});
			return res.send({
				success: 1,
				message: 'Password updated  successfully'
			})

			// } else {
			// 	return res.send({
			// 		success: 0,
			// 		message: 'Current password is incorrect'
			// 	})
			// }


		},
		//CURD for Targetmapping
		this.listTargetMapping = async (req, res) => {
			let params = req.query;

			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			let offset = (page - 1) * perPage;

			let whereCondition = {
				status: 1
			}

			if (params.question_id) {
				whereCondition.question_id = params.question_id
			}
			if (params.target_question) {
				whereCondition.question = params.target_question
			}
			if (params.lsgi_type_id) {
				whereCondition.lsgi_type_id = params.lsgi_type_id
			}
			// if (params.lsgi_type) {
			//     whereCondition.lsgi_type = params.lsgi_type
			// }
			if (params.target) {
				whereCondition.target = params.target
			}
			if (params.keyword) {
				let question = {
					[Op.like]: '%' + params.keyword + '%',
				};
				let target = {
					[Op.like]: '%' + params.keyword + '%'
				};
				whereCondition = Sequelize.or({ question }, { target })
			}
			let targetMappingData = await TargetMapping.findAll({
				// raw: true,
				order: [
					['modified_at', 'DESC']
				],

				offset: offset,
				where: whereCondition,
				include: [{
					model: LsgiType
				}],

				limit: perPage,
			})


			let count = await TargetMapping.count({
				where: whereCondition,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching TargetMapping data',
						error: err
					})
				});


			totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			let hasNextPage = page < totalPages;
			let response = {
				items: targetMappingData,
				total_items: count,
				has_next_page: hasNextPage,
				total_pages: totalPages,
				page,
				per_page: perPage,
				message: "targetMappingData listed successfully",
				success: 1,
			}
			res.send(response);

		},

		this.createTargetMapping = async (req, res) => {
			let params = req.body;

			if (!params.question_id || !params.target_question || !params.lsgi_type_id || !params.target) {
				var errors = [];
				if (!params.question_id) {
					errors.push({
						field: "question_id",
						message: 'Require Question ID'

					});
				}
				if (!params.target_question) {
					errors.push({
						field: "target_question",
						message: 'Require Target Question'
					});
				}
				if (!params.lsgi_type_id) {
					errors.push({
						field: "lsgi_typeid",
						message: 'Require Lsgi Type ID'
					})
				}
				// if (!params.lsgi_type) {
				//     errors.push({
				//         field: "lsgi_type",
				//         message: 'Require Lsgi Type'
				//     })
				// }
				if (!params.target) {
					errors.push({
						field: "target_value",
						message: 'Require Target Value'
					})
				}
				return res.send({
					success: 0,
					statusCode: 400,
					errors: errors,
				});
			};
			let targetObj = {
				question_id: params.question_id,
				question: params.target_question.trim(),
				lsgi_type_id: params.lsgi_type_id,
				// lsgi_type: params.lsgi_type.trim(),
				target: params.target,
				status: 1
			}

			try {
				let data = await TargetMapping.create(targetObj);
				res.status(200).send({
					success: 1,
					id: data.dataValues.id,
					message: "target mapping created successfully."
				});
			} catch (err) {
				console.log(err);
				return res.send({
					success: 0,
					message: 'Error while creating target mapping'
				})
			}
		},

		this.updateTargetMapping = async (req, res) => {
			let targetMappingId = req.params.id;
			let update = {};
			update.modified_at = new Date();
			update.status = 1;
			if (!req.body.question_id && !req.body.target_question && !req.body.lsgi_type_id && !req.body.target) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}
			if (req.body.question_id) {
				update.question_id = req.body.question_id;
			}
			if (req.body.target_question) {
				update.question = req.body.target_question;
			}
			if (req.body.lsgi_type_id) {
				update.lsgi_type_id = req.body.lsgi_type_id;
			}
			// if (req.body.lsgi_type) {
			//     update.lsgi_type = req.body.lsgi_type;
			// }
			if (req.body.target) {
				update.target = req.body.target;
			}

			let targetMappingData = await TargetMapping.findOne({
				where: {
					id: targetMappingId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking targetMappingId exists or not',
						error: err
					})
				})
			if (!targetMappingData) {
				return res.send({
					success: 0,
					message: 'Invalid targetMappingData '
				})
			} else {

				await TargetMapping.update(update, {
					where: {
						id: targetMappingId
					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating targetMappingId',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "TargetMapping updated successfully."
				});
			}

		},

		this.getTargetMapping = async (req, res) => {
			let targetMappingId = req.params.id;
			let targetMappingObj = await TargetMapping.findOne({
				where: {
					id: targetMappingId,
					status: 1
				},
				include: ['lsgiType']
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting target type data',
						error: err
					})
				})


			let response = {
				targetMapping: targetMappingObj,
				success: 1,
			}

			return res.send(response);
		},

		this.deleteTargetMapping = async (req, res) => {
			let targetMappingId = req.params.id;
			let targetMappingData = await TargetMapping.findOne({
				where: {
					id: targetMappingId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while deleting Target Mapping data',
						error: err
					})
				})
			if (targetMappingData) {
				let update = {
					status: 0
				}
				await TargetMapping.update(update, {
					where: {
						id: targetMappingData.id

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while deleting Target Mapping',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Target Mapping deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "TargetMapping not exists."
				});
			}
		},

		//CRUD for Question operation.
		this.listQuestionOperation = async (req, res) => {
			let params = req.query;

			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			let offset = (page - 1) * perPage;

			let whereCondition = {
				status: 1
			}

			if (params.type) {
				whereCondition.type = params.type
			}
			if (params.keyword) {
				let type = {
					[Op.like]: '%' + params.keyword + '%',
				};
				whereCondition = Sequelize.or({ target })
			}
			let questionOperationData = await QuestionOperation.findAll({
				// raw: true,
				order: [
					['modified_at', 'DESC']
				],

				offset: offset,
				limit: perPage,
			})


			let count = await QuestionOperation.count({
				where: whereCondition,
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while fetching Question Operation',
						error: err
					})
				});


			totalPages = count / perPage;
			totalPages = Math.ceil(totalPages);
			let hasNextPage = page < totalPages;
			let response = {
				items: questionOperationData,
				total_items: count,
				has_next_page: hasNextPage,
				total_pages: totalPages,
				page,
				per_page: perPage,
				message: "Question Operation Data listed successfully",
				success: 1,
			}
			res.send(response);

		},

		this.createQuestionOperation = async (req, res) => {
			let params = req.body;

			if (!params.type) {
				var errors = [];
				if (!params.type) {
					errors.push({
						field: "type",
						message: 'Require Question ID'

					});
				}
				return res.send({
					success: 0,
					statusCode: 400,
					errors: errors,
				});
			};
			let questionOperationObj = {
				type: params.type,
				status: 1
			}

			try {
				let data = await QuestionOperation.create(questionOperationObj);
				res.status(200).send({
					success: 1,
					id: data.dataValues.id,
					message: "Question Operation created successfully."
				});
			} catch (err) {
				console.log(err);
				return res.send({
					success: 0,
					message: 'Error while creating question operation'
				})
			}
		},

		this.updateQuestionOperation = async (req, res) => {
			let questionOperationId = req.params.id;
			let update = {};
			update.modified_at = new Date();
			update.status = 1;
			if (!req.body.type) {
				return res.send({
					success: 0,
					message: 'Nothing to update'
				})
			}
			if (req.body.type) {
				update.type = req.body.type;
			}

			let questionOperationData = await QuestionOperation.findOne({
				where: {
					id: questionOperationId
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while checking Question OperationId exists or not',
						error: err
					})
				})
			if (!questionOperationData) {
				return res.send({
					success: 0,
					message: 'Invalid Question Operation Data '
				})
			} else {

				await questionOperationData.update(update, {
					where: {
						id: questionOperationId
					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while updating Question OperationId',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Question Operation updated successfully."
				});
			}

		},

		this.getQuestionOperation = async (req, res) => {
			let questionOperationId = req.params.id;
			let questionOperationObj = await QuestionOperation.findOne({
				where: {
					id: questionOperationId,
					status: 1
				},
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while getting Question Operation type data',
						error: err
					})
				})


			let response = {
				targetMapping: questionOperationObj,
				success: 1,
			}

			return res.send(response);
		},

		this.deleteQuestionOperation = async (req, res) => {
			let questionOperationId = req.params.id;
			let questionOperationData = await QuestionOperation.findOne({
				where: {
					id: questionOperationId,
					status: 1
				}
			})
				.catch(err => {
					return res.send({
						success: 0,
						message: 'Something went wrong while deleting Question Operation data',
						error: err
					})
				})
			if (questionOperationData) {
				let update = {
					status: 0
				}
				await QuestionOperation.update(update, {
					where: {
						id: questionOperationData.id

					}
				})
					.catch(err => {
						return res.send({
							success: 0,
							message: 'Something went wrong while deleting Question Operation Data',
							error: err
						})
					})
				res.status(200).send({
					success: 1,
					message: "Question Operation deleted successfully."
				});
			} else {
				res.status(200).send({
					success: 1,
					message: "Question Operation Data not exists."
				});
			}
		}
		, this.getGradeReport = async (req, res) => {
			let params = req.query;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			let lsgiCondition = {}

			if (params.district_id) {
				whereCondition.district_id = params.district_id
			}
			if (params.grade) {
				whereCondition.grade = params.grade
			}


			if (params.lsgi_type_id) {
				whereCondition.lsgi_type_id = params.lsgi_type_id
			}

			if (params.lsgi_id) {
				whereCondition.lsgi_id = params.lsgi_id
			}
			if (params.lsgi_block_id) {
				whereCondition.lsgi_block_id = params.lsgi_block_id
			}


			if (params.name) {
				lsgiCondition.name_en = {
					[Op.like]: '%' + params.name + '%',
				};
			}



			if (params.start_date || params.end_date) {
				if (params.start_date && !params.end_date) {

					let startdate = params.start_date;
					console.log(startdate);

					chkNullDate(startdate, res);


					whereCondition.created_at = {
						[Op.gte]: startdate,
						[Op.lte]: new Date()
					}
				}
				if (!params.start_date && params.end_date) {
					let enddate = params.end_date;
					console.log(enddate);
					chkNullDate(enddate, res);


					whereCondition.created_at = {
						[Op.lte]: enddate
					}

				}
				if (params.start_date && params.end_date) {
					let startdate = params.start_date;
					let enddate = params.end_date;
					console.log(startdate);
					console.log(enddate);
					chkNullDate(startdate, res);

					chkNullDate(enddate, res);


					whereCondition.created_at = {
						[Op.between]: [startdate, enddate]
					}
				}
			}

			let userDataz = req.identity.data;
			if (userDataz.district_id && userDataz.district_id != null) {
				whereCondition.district_id = userDataz.district_id;
			}
			if (userDataz.lsgi_id && userDataz.lsgi_id != null) {
				whereCondition.lsgi_id = userDataz.lsgi_id;
			}
			if (userDataz.lsgi_block_id && userDataz.lsgi_block_id != null) {
				whereCondition.lsgi_block_id = userDataz.lsgi_block_id;
			}

			lsgiCondition.status = 1;
			let typeCondition = {}
			typeCondition.status = 1;
			if (params.keyword) {
				lsgiCondition.name_en = {
					[Op.like]: '%' + params.keyword + '%',
				};
				typeCondition.name_en = {
					[Op.like]: '%' + params.keyword + '%'
				};

			}
			let dataStructure = {
				lsgi_name: null,
				lsgi_id: null,
				Grades: {
					January: {
						survey_id: null,
						grade: null,
						grade_value: null,
						survey_date: null
					},
					February: {
						survey_id: null,
						grade: null,
						grade_value: null,
						survey_date: null
					},
					March: {
						survey_id: null,
						grade: null,
						grade_value: null,
						survey_date: null
					},
					April: {
						survey_id: null,
						grade: null,
						grade_value: null,
						survey_date: null
					},
					May: {
						survey_id: null,
						grade: null,
						grade_value: null,
						survey_date: null
					},
					June: {
						survey_id: null,
						grade: null,
						grade_value: null,
						survey_date: null
					},
					July: {
						survey_id: null,
						grade: null,
						grade_value: null,
						survey_date: null
					},
					August: {
						survey_id: null,
						grade: null,
						grade_value: null,
						survey_date: null
					},
					September: {
						survey_id: null,
						grade: null,
						grade_value: null,
						survey_date: null
					},
					October: {
						survey_id: null,
						grade: null,
						grade_value: null,
						survey_date: null
					},
					November: {
						survey_id: null,
						grade: null,
						grade_value: null,
						survey_date: null
					},
					December: {
						survey_id: null,
						grade: null,
						grade_value: null,
						survey_date: null
					}
				}
			}
			let gradeConfig = {}

			let gradeConfigs = await GradeConfiguaration.findAll({
				attributes: ['grade', 'end_value'],
				where: {
					status: 1
				}
			}).then(gradeConf => gradeConf.map(grades => gradeConfig[grades.grade] = grades.end_value));


			console.log(JSON.stringify(gradeConfig));

			let datas1 = await SurveyHistory.findAll({
				where: whereCondition,
				raw: true,
				attributes: [[Sequelize.fn('max', Sequelize.col('id')), 'id']],
				group: ['lsgi_id', [Sequelize.fn('date_format', Sequelize.col('survey_date'), '%M'), 'survey_month']]
			}).then(surveyIds => surveyIds.map(surveyId => surveyId.id));

			//console.log(JSON.stringify(datas1));

			whereCondition.id = datas1;
			let monthlyReports = await SurveyHistory.findAll({
				attributes: ['id', 'survey_id', 'lsgi_id'
					, 'lsgi.name_en', 'grade', 'points', 'survey_date', 'created_at'],
				include: [{
					model: Lsgi,
					where: lsgiCondition
				}],
				order: ['lsgi_id', 'survey_date'],
				where: whereCondition


			})
			// console.log(JSON.stringify(monthlyReports));
			let gradeWiseArray = [];

			monthlyReports.map(async (item, index) => {

				const date = new Date(item.survey_date);
				const month = date.toLocaleString('default', { month: 'long' });
				//console.log(month);
				let gradeUpdated = false;
				gradeWiseArray.map(async (val) => {
					// console.log(val);
					if (val.lsgi_id == item.lsgi_id) {
						//lsgi Already exist we need to update grades
						val.Grades[month].grade = item.grade;
						val.Grades[month].survey_date = item.survey_date;
						val.Grades[month].survey_id = item.survey_id;
						val.Grades[month].grade_value = gradeConfig[item.grade]
						gradeUpdated = true;
						return
					}
				})

				if (!gradeUpdated) {
					//Grade lsgi is not found so push into grade wise array.

					var temp = JSON.parse(JSON.stringify(dataStructure));
					temp.lsgi_id = item.lsgi_id;
					temp.lsgi_name = item.lsgi.name_en;
					temp.Grades[month].grade = item.grade;
					temp.Grades[month].survey_date = item.survey_date;
					temp.Grades[month].survey_id = item.survey_id;
					temp.Grades[month].grade_value = gradeConfig[item.grade]

					gradeWiseArray.push(temp);


				}

			})
			console.log(JSON.stringify(gradeWiseArray));


			totalPages = gradeWiseArray.length / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: gradeWiseArray,
				total_items: gradeWiseArray.length,
				has_next_page: hasNextPage,
				total_pages: totalPages,
				page,
				per_page: perPage,
				message: "Grade Wise Report listed successfully",
				success: 1,
			}
			res.send(response);

		}
		, this.getPointReport = async (req, res) => {
			let params = req.query;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			let lsgiCondition = {}

			if (params.district_id) {
				whereCondition.district_id = params.district_id
			}
			if (params.points) {
				whereCondition.points = params.points
			}


			if (params.lsgi_type_id) {
				whereCondition.lsgi_type_id = params.lsgi_type_id
			}

			if (params.lsgi_id) {
				whereCondition.lsgi_id = params.lsgi_id
			}
			if (params.lsgi_block_id) {
				whereCondition.lsgi_block_id = params.lsgi_block_id
			}


			if (params.name) {
				lsgiCondition.name_en = {
					[Op.like]: '%' + params.name + '%',
				};
			}

			if (params.start_date || params.end_date) {
				if (params.start_date && !params.end_date) {

					let startdate = params.start_date;
					console.log(startdate);

					chkNullDate(startdate, res);


					whereCondition.created_at = {
						[Op.gte]: startdate,
						[Op.lte]: new Date()
					}
				}
				if (!params.start_date && params.end_date) {
					let enddate = params.end_date;
					console.log(enddate);
					chkNullDate(enddate, res);


					whereCondition.created_at = {
						[Op.lte]: enddate
					}

				}
				if (params.start_date && params.end_date) {
					let startdate = params.start_date;
					let enddate = params.end_date;
					console.log(startdate);
					console.log(enddate);
					chkNullDate(startdate, res);

					chkNullDate(enddate, res);


					whereCondition.created_at = {
						[Op.between]: [startdate, enddate]
					}
				}
			}

			let userDataz = req.identity.data;
			if (userDataz.district_id && userDataz.district_id != null) {
				whereCondition.district_id = userDataz.district_id;
			}
			if (userDataz.lsgi_id && userDataz.lsgi_id != null) {
				whereCondition.lsgi_id = userDataz.lsgi_id;
			}
			if (userDataz.lsgi_block_id && userDataz.lsgi_block_id != null) {
				whereCondition.lsgi_block_id = userDataz.lsgi_block_id;
			}

			lsgiCondition.status = 1;
			let typeCondition = {}
			typeCondition.status = 1;
			if (params.keyword) {
				lsgiCondition.name_en = {
					[Op.like]: '%' + params.keyword + '%',
				};
				typeCondition.name_en = {
					[Op.like]: '%' + params.keyword + '%'
				};

			}
			let dataStructure = {
				lsgi_name: null,
				lsgi_id: null,
				Points: {
					January: {
						survey_id: null,
						points: null,
						survey_date: null
					},
					February: {
						survey_id: null,
						points: null,
						survey_date: null
					},
					March: {
						survey_id: null,
						points: null,
						survey_date: null
					},
					April: {
						survey_id: null,
						points: null,
						survey_date: null
					},
					May: {
						survey_id: null,
						points: null,
						survey_date: null
					},
					June: {
						survey_id: null,
						points: null,
						survey_date: null
					},
					July: {
						survey_id: null,
						points: null,
						survey_date: null
					},
					August: {
						survey_id: null,
						points: null,
						survey_date: null
					},
					September: {
						survey_id: null,
						points: null,
						survey_date: null
					},
					October: {
						survey_id: null,
						points: null,
						survey_date: null
					},
					November: {
						survey_id: null,
						points: null,
						survey_date: null
					},
					December: {
						survey_id: null,
						points: null,
						survey_date: null
					}
				}

			}

			let datas1 = await SurveyHistory.findAll({
				where: whereCondition,
				raw: true,
				attributes: [[Sequelize.fn('max', Sequelize.col('id')), 'id']],
				group: ['lsgi_id', [Sequelize.fn('date_format', Sequelize.col('survey_date'), '%M'), 'survey_month']]
			}).then(surveyIds => surveyIds.map(surveyId => surveyId.id));

			whereCondition.id = datas1;
			let monthlyReports = await SurveyHistory.findAll({
				attributes: ['id', 'survey_id', 'lsgi_id'
					, 'lsgi.name_en', 'grade', 'points', 'survey_date', 'created_at'],
				include: [{
					model: Lsgi,
					where: lsgiCondition
				}],
				order: ['lsgi_id', 'survey_date'],
				where: whereCondition


			})
			// console.log(JSON.stringify(monthlyReports));
			let pointWiseArray = [];

			monthlyReports.map(async (item, index) => {

				const date = new Date(item.survey_date);
				const month = date.toLocaleString('default', { month: 'long' });
				//console.log(month);
				let pointUpdated = false;
				pointWiseArray.map(async (val) => {
					// console.log(val);
					if (val.lsgi_id == item.lsgi_id) {
						//lsgi Already exist we need to update grades
						val.Points[month].points = item.points;
						val.Points[month].survey_date = item.survey_date;
						val.Points[month].survey_id = item.survey_id;

						pointUpdated = true;
						return
					}
				})

				if (!pointUpdated) {
					//Grade lsgi is not found so push into grade wise array.

					var temp = JSON.parse(JSON.stringify(dataStructure));
					temp.lsgi_id = item.lsgi_id;
					temp.lsgi_name = item.lsgi.name_en;
					temp.Points[month].points = item.points;
					temp.Points[month].survey_date = item.survey_date;
					temp.Points[month].survey_id = item.survey_id;

					pointWiseArray.push(temp);


				}

			})
			
			totalPages = pointWiseArray.length / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: pointWiseArray,
				total_items: pointWiseArray.length,
				has_next_page: hasNextPage,
				total_pages: totalPages,
				page,
				per_page: perPage,
				message: "Point Wise Report listed successfully",
				success: 1,
			}
			res.send(response);

		}
		, this.getQuestionReport = async (req, res) => {
			let params = req.query;
			let page = params.page || 1;
			let perPage = Number(params.per_page) || 10;
			perPage = perPage > 0 ? perPage : 10;
			var offset = (page - 1) * perPage;
			let whereCondition = {};
			let lsgiCondition = {}

			if(!params.lsgi_id){
				return res.send({
					success:0,
					message:'Lsgi_id Required to show reseult'
				})
			}

			if (params.district_id) {
				whereCondition.district_id = params.district_id
			}

			if (params.lsgi_type_id) {
				whereCondition.lsgi_type_id = params.lsgi_type_id
			}

			if (params.lsgi_id) {
				whereCondition.lsgi_id = params.lsgi_id
			}
			if (params.lsgi_block_id) {
				whereCondition.lsgi_block_id = params.lsgi_block_id
			}

			if (params.name) {
				lsgiCondition.name_en = {
					[Op.like]: '%' + params.name + '%',
				};
			}

			if (params.start_date || params.end_date) {
				if (params.start_date && !params.end_date) {

					let startdate = params.start_date;
					console.log(startdate);

					chkNullDate(startdate, res);


					whereCondition.created_at = {
						[Op.gte]: startdate,
						[Op.lte]: new Date()
					}
				}
				if (!params.start_date && params.end_date) {
					let enddate = params.end_date;
					console.log(enddate);
					chkNullDate(enddate, res);


					whereCondition.created_at = {
						[Op.lte]: enddate
					}

				}
				if (params.start_date && params.end_date) {
					let startdate = params.start_date;
					let enddate = params.end_date;
					console.log(startdate);
					console.log(enddate);
					chkNullDate(startdate, res);

					chkNullDate(enddate, res);


					whereCondition.created_at = {
						[Op.between]: [startdate, enddate]
					}
				}
			}

			let userDataz = req.identity.data;
			if (userDataz.district_id && userDataz.district_id != null) {
				whereCondition.district_id = userDataz.district_id;
			}
			if (userDataz.lsgi_id && userDataz.lsgi_id != null) {
				whereCondition.lsgi_id = userDataz.lsgi_id;
			}
			if (userDataz.lsgi_block_id && userDataz.lsgi_block_id != null) {
				whereCondition.lsgi_block_id = userDataz.lsgi_block_id;
			}

			lsgiCondition.status = 1;
			let typeCondition = {}
			typeCondition.status = 1;
			if (params.keyword) {
				lsgiCondition.name_en = {
					[Op.like]: '%' + params.keyword + '%',
				};
				typeCondition.name_en = {
					[Op.like]: '%' + params.keyword + '%'
				};

			}
		
			let datas1 = await SurveyHistory.findAll({
				where: whereCondition,
				raw: true,
				attributes: [[Sequelize.fn('max', Sequelize.col('id')), 'id']],
				group: ['lsgi_id', [Sequelize.fn('date_format', Sequelize.col('survey_date'), '%M'), 'survey_month']]
			}).then(surveyIds => surveyIds.map(surveyId => surveyId.id));

			let answers = await SurveyHistory.findAll({
				raw: true,
				attributes: ['survey_date'],
				include: [{
					model: SurveyAnswerHistory,
					attributes: ['question_id', 'answer', 'survey_history_id'],
					where: {
						survey_history_id: datas1
					},
					include: [{
						model: Question,
						attributes: ['id', 'question_en']
					}, {
						model: QuestionOption,
						attributes: ['id', 'name_en']
					}]
				}]

			}).catch(err => {
				return {
					success: 0,
					message: 'Something went wrong while fetching SurveyHistoryAnswer data',
					error: err
				};
			});
		
			let answerWiseArray = [];
			let questionArray = []
			for (let a = 0; a < answers.length; a++) {
				let item = answers[a];
				const date = new Date(item.survey_date);
				const month = date.toLocaleString('default', { month: 'long' });
				let answerUpdated = false;
				for (let k = 0; k < answerWiseArray.length; k++) {
					let val = answerWiseArray[k];
					if (val.survey_history_id == item["surveyAnswerHistories.survey_history_id"]) {
						//month Already exist we need to update values

						let ansW;
						if (item["surveyAnswerHistories.answer"] != null) {
							ansW = item["surveyAnswerHistories.answer"];
						} else {
							ansW = item["surveyAnswerHistories.questionOption.name_en"];
						}

						val["q"+item["surveyAnswerHistories.question_id"]] = ansW;
						
						var questionExists = false;
						for(let q in questionArray){
							let ques = questionArray[q];
							if(ques.name == "q"+item["surveyAnswerHistories.question_id"]) {
								questionExists = true;
								break;
							}
						}

						if(!questionExists)
							questionArray.push({
								"name": "q"+item["surveyAnswerHistories.question_id"],
								"label": item["surveyAnswerHistories.question.question_en"]
							})
						answerUpdated = true;
						break;
					}
				}

				if (!answerUpdated) {

					var temp = {};
					temp.month = month;
					temp.survey_history_id = item["surveyAnswerHistories.survey_history_id"];
					let ansW;
					if (item["surveyAnswerHistories.answer"] != null) {
						ansW = item["surveyAnswerHistories.answer"];
					} else {
						ansW = item["surveyAnswerHistories.questionOption.name_en"];
					}
					
					temp["q"+item["surveyAnswerHistories.question_id"]] = ansW;
					answerWiseArray.push(temp);


					var questionExists = false;
					for(let q in questionArray){
						let ques = questionArray[q];
						if(ques.name == "q"+item["surveyAnswerHistories.question_id"]) {
							questionExists = true;
							break;
						}
					}

					if(!questionExists)
						questionArray.push({
							"name":"month",
							"label":"Month"
						},{
							"name": "q"+item["surveyAnswerHistories.question_id"],
							"label": item["surveyAnswerHistories.question.question_en"]
						})
				}

			}
			
			totalPages = answerWiseArray.length / perPage;
			totalPages = Math.ceil(totalPages);
			var hasNextPage = page < totalPages;
			let response = {
				items: answerWiseArray,
				headers: questionArray,
				total_items: answerWiseArray.length,
				has_next_page: hasNextPage,
				total_pages: totalPages,
				page,
				per_page: perPage,
				message: "Question Answer Wise Report listed successfully",
				success: 1,
			}
			res.send(response);

		}

,

	//Get user type
	this.listUserType= async (req, res) =>{
		let params = req.query;

		let page = params.page || 1;
		let perPage = Number(params.per_page) || 10;
		perPage = perPage > 0 ? perPage : 10;
		let offset = (page - 1) * perPage;


		let whereCondition = {
			visibility: 1,
			status: 1,
		}

		if (params.name) {
			whereCondition.name = params.name
		}

		if (params.keyword) {
			let question = {
				[Op.like]: '%' + params.keyword + '%',
			};
			let target = {
				[Op.like]: '%' + params.keyword + '%'
			};
			whereCondition = Sequelize.or({ name })
		}
		let userTypeData = await UserType.findAll({
			// raw: true,
			order: [
				['modified_at', 'DESC']
			],
			offset: offset,
			where: whereCondition,
			limit: perPage,
		})


		let count = await UserType.count({
			where: whereCondition,
		})
			.catch(err => {
				return res.send({
					success: 0,
					message: 'Something went wrong while fetching TargetMapping data',
					error: err
				})
			});


		totalPages = count / perPage;
		totalPages = Math.ceil(totalPages);
		let hasNextPage = page < totalPages;
		let response = {
			items: userTypeData,
			total_items: count,
			has_next_page: hasNextPage,
			total_pages: totalPages,
			page,
			per_page: perPage,
			message: "User Type listed successfully",
			success: 1,
		}
		res.send(response);

	}
}
module.exports = adminController
