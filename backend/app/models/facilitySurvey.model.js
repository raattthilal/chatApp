module.exports = function FacilitySurvey(sequelize) {
  var Sequelize = sequelize.constructor;
  // var district = require('./district.model') (sequelize);
  var lsgi = require('./lsgi.model')(sequelize);
  var categoryRelationship = require('./categoryRelationship.model')(sequelize);
  var user = require('./user.model')(sequelize);
  var ward = require('./ward.model')(sequelize);
  var facilityType = require('./facilityType.model')(sequelize);
  var QuestOption = require('./facilitySurveyQuestionOption.model')(sequelize);
  var district = require('./district.model')(sequelize);
  var facilitySurveyAnswer = require('./facilitySurveyAnswer.model')(sequelize);
  var ret =
    sequelize.define('facilitySurvey', {
      lsgi_id: {
        type: Sequelize.INTEGER
      },
      district_id: {
        type: Sequelize.INTEGER
      },
      surveyor_account_id: {
        type: Sequelize.INTEGER
      },
      is_approved: {
        type: Sequelize.INTEGER
      },
      approved_by: {
        type: Sequelize.INTEGER
      },
      approved_date: {
        type: 'TIMESTAMP'
      },
      ward_id: {
        type: Sequelize.INTEGER
      },
      facility_type_id: {
        type: Sequelize.INTEGER
      },
      lat: {
        type: Sequelize.DOUBLE
      },
      lng: {
        type: Sequelize.DOUBLE
      },
      is_sent_to_server: {
        type: Sequelize.INTEGER
      },
      category_relationship_id: {
        type: Sequelize.INTEGER
      },
      status: {
        type: Sequelize.INTEGER
      },
      created_at: {
        type: 'TIMESTAMP',
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false
      },
      modified_at: {
        type: 'TIMESTAMP',
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false
      },

    }, {
      tableName: 'facility_survey',
      timestamps: false

    });
  // ret.belongsTo(lsgi, {foreignKey: 'lsgi_id'});
  // ret.belongsTo(district, {foreignKey: 'district_id'});
  //   ret.relations = {
  //     lsgiType:lsgiType,
  //     lsgiBlock:lsgiBlock
  // };
  ret.hasMany(facilitySurveyAnswer, {foreignKey: 'facility_survey_id'});
  ret.belongsTo(lsgi, { foreignKey: 'lsgi_id' });
  ret.belongsTo(district, { foreignKey: 'district_id' });
  ret.belongsTo(categoryRelationship, { foreignKey: 'category_relationship_id' });
  ret.belongsTo(user, { foreignKey: 'surveyor_account_id' });
  ret.belongsTo(ward, { foreignKey: 'ward_id' });
  //ret.belongsTo(QuestOption, { foreignKey: 'technology_id', as : 'technologys'});
  //ret.belongsTo(QuestOption, { foreignKey: 'is_operational', as : 'operational'});
  ret.belongsTo(facilityType, { foreignKey: 'facility_type_id' });

  //   ret.belongsTo(lsgiBlock, {foreignKey: 'lsgi_block_id'});

  return ret;
}
